
import React from 'react';
import utils from './utils.js';

class Node extends React.Component{
    shouldComponentUpdate(props, state){
        return (props.node !== this.props.node);
    }
    getBoundingRect = () => {
        return this.refs.node.getBoundingClientRect();
    };
    setData = (data) => {
        let { diagram, node } = this.props;
        diagram.setNodes([{
            id: node.id,
            data
        }]);
    };
    render(){
        let { diagram, node } = this.props;
        let { id, x, y, title, ports = [] } = node;
        return (
            <div 
                style={{ cursor: 'move', position: 'absolute', top: y, left: x, userSelect: 'none', border: '1px solid #b66' }}
                ref="node"
                unselectable="on"
                data-node-id={id}>
                <div>{title}</div>
                <div>
                    {ports.map(port => 
                        <Port key={port.id} port={port} diagram={diagram}/>
                    )}
                </div>
            </div>
        );
    }
};


class Link extends React.Component{
    shouldComponentUpdate(props, state){
        return (props.link !== this.props.link);
    }
    render(){
        let {diagram, link} = this.props;
        let { id, startPoint, endPoint, points = [], className, strokeWidth = "3", stroke = "rgba(255,255,255,0.5)", curvyness = 0 } = link;
        let pointsToRender = [startPoint, ...points, endPoint];
        let lines = [];
        let circles = [];
        pointsToRender.map((point, i) => {
            if(!point){ return; }
            if(pointsToRender[i+1]){
                lines.push(
                    <path
                        key={`back-${i}`}
                        className={className}
                        strokeWidth={16}
                        stroke={'rgba(250,250,250,0.05)'}
                        strokeLinecap="round"
                        data-link-from={pointsToRender[i].id || '__start'}
                        data-link-to={pointsToRender[i+1].id}
                        style={{pointerEvents: 'all'}}
                        d={diagram.utils.generateLinkPath(point, pointsToRender[i+1], 0)}
                    />,
                    <path
                        key={i}
                        className={className}
                        strokeWidth={strokeWidth}
                        stroke={stroke}
                        strokeLinecap="round"                        
                        d={diagram.utils.generateLinkPath(point, pointsToRender[i+1], 0)}
                    />
                )
            }
            if(i > 0){
                circles.push(
                    <circle 
                        key={`back-${i}`} 
                        data-point-id={point.id} 
                        cx={point.x} 
                        cy={point.y} 
                        r="12" 
                        style={{fill: "rgba(255,255,255,0.05)", pointerEvents: 'all', cursor: 'move'}}>
                    </circle>,
                    <circle 
                        key={i} 
                        cx={point.x} 
                        cy={point.y} 
                        r="5" 
                        style={{fill: "rgba(255,255,255,0.5)"}}>
                    </circle>
                )
            }
        })
        return (
            <div 
                style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none'}}
                data-link-id={id}>
                <svg 
                    style={{ overflow: 'visible' }}
                >
                    <g>
                        {lines}
                        {circles}
                    </g>
                </svg>
            </div>
        );
    }
}

class Port extends React.Component{
    constructor(props){
        super(props);
        this.state = {
            hovered: false
        };
    }
    shouldComponentUpdate(props, state){
        return (props.port !== this.props.port || state !== this.state);
    }
    onMouseEnter = () => {
        this.setState({ hovered: true });
    };
    onMouseLeave = () => {
        this.setState({ hovered: false });
    };
    render(){
        let {diagram, port} = this.props;
        let {hovered} = this.state;
        return (
            <div 
                onMouseEnter={this.onMouseEnter}
                onMouseLeave={this.onMouseLeave}
                data-port-id={port.id}
                style={{width: 20, height: 20, background: hovered ? 'green' : 'blue'}}>

            </div>
        );
    }
}

class Point extends React.Component{
    render(){
        let {diagram, point} = this.props;
        return (
            <div style={{position: 'absolute', top: point.x, left: point.y}}>Point</div>
        );
    }
}

class Nodes extends React.Component{
    shouldComponentUpdate(props, state){
        return (props.nodes !== this.props.nodes);
    }
    render(){
        let {nodes, diagram} = this.props;
        return nodes.map(node => <Node node={node} key={node.id} diagram={diagram}/>);
    }
}

class Links extends React.Component{
    shouldComponentUpdate(props, state){
        return (props.links !== this.props.links);
    }
    render(){
        let {links, diagram} = this.props;
        return links.map(link => <Link link={link} key={link.id} diagram={diagram}/>);
    }
}

export default class Diagram extends React.Component{
    constructor(props){
        super(props);
        this.utils = utils;
        this.updatedNodes = {};
        this.updatedPoints = {};
        this.state = {
            data: {...props.data || {}, links: []},
            action: null,
            mouseIsDown: false,
            lastMousePosition: {x:0,y:0}
        };
    }

    componentDidMount(){
        document.addEventListener('mouseup', this.onMouseUp);
        document.addEventListener('mousemove', this.onMouseMove);
        let links = (this.props.data || {}).links || [];
        this.setData(['links'], links);
        window.diagram = this;
    }

    componentDidUpdate(){
        let nodeKeys = Object.keys(this.updatedNodes);
        let pointKeys = Object.keys(this.updatedPoints);
        let {data} = this.state;
        let linksToUpdate = {};

        // if nodes have updated
        if(nodeKeys.length){ 
            // should any links be updated because of node movement?   
            nodeKeys.map(key => {                
                let node = this.updatedNodes[key];
                (node.ports || []).map(port => {
                    (port.links || []).map(id => linksToUpdate[id] = 1)
                })
            });
            
            
        }

        // if link points have been moved
        if(pointKeys.length){
            // should any links be updated because of point movement?
            pointKeys.map(key => {
                let linkId = key.split(':')[0];
                linksToUpdate[linkId] = 1;
            })
            
        }

        // if any links should be updated
        if(Object.keys(linksToUpdate).length){
            // loop through all existing links
            this.setData(['links'], links => links.map(link => {
                // if a link shoud be re-rendered 
                if(linksToUpdate[link.id]){                    
                    // update the start and end points of the link
                    // to match the position of ports that it connects to
                    let startPoint = this.getPortCenter(...link.fromPort);
                    let endPoint = link.toPort ? this.getPortCenter(...link.toPort) : null;
                    let points = (link.points || []).map(point => {
                        let movedPoint = this.updatedPoints[`${link.id}:${point.id}`];
                        if(movedPoint){
                            return { ...point, x: movedPoint.x, y: movedPoint.y };
                        }
                        return point;
                    });
                    return {
                        ...link, 
                        startPoint,
                        endPoint,
                        points
                    };
                }
                return link;
            }));
        }
        this.updatedNodes = {};
        this.updatedPoints = {};
    }

    componentWillUnmount(){
        document.removeEventListener('mouseup', this.onMouseUp);
        document.removeEventListener('mousemove', this.onMouseMove);
    }

    moveItems = (action) => {
        this.setState({
            action: {
                type: 'moveItems',
                ...action
            }
        });
    };

    getLocalPosition = ({clientX = 0, clientY = 0}, zoom) => {
        let {diagram} = this.state.data;
        let rect = this.getBoundingRect();
        zoom = zoom || diagram.zoom;
        return {
            x: (clientX - rect.left - diagram.x) / zoom,
            y: (clientY - rect.top - diagram.y) / zoom,
        };
    };

    onMouseDown = (e) => {
        let targets = utils.getTargets(e.target);
        let mousePosition = {x: e.clientX, y: e.clientY};
        let localMousePosition = this.getLocalPosition(e);
        // if mouse went down inside a node
        if(targets.nodeId){
            // if mouse went down inside a port
            if(targets.portId){
                // we pull a new link from the port
                let movingPoint = utils.withId(localMousePosition);
                let link = this.addLink({
                    "type": "link",
                    "fromPort": [
                        targets.nodeId,
                        targets.portId
                    ],
                    "toPort": null,
                    "startPoint": movingPoint,
                    "endPoint": null,
                    "curvyness": 5,
                    "points": [movingPoint]
                });
                this.moveItems({
                    subType: 'createLink',
                    targets,
                    points: [
                        [link.id, movingPoint.id]
                    ]
                });
            }
            // if mouse went down inside a port
            else{
                // move the node
                this.moveItems({
                    subType: 'moveNode',
                    targets,
                    nodes: [targets.nodeId]
                });
            }
        }
        else if(targets.linkId){
            let link = this.getLink(targets.linkId);
            // if the mouse went down on a point
            if(targets.pointId){
                // move the point
                this.moveItems({
                    subType: 'movePoint',
                    targets,
                    points: [
                        [targets.linkId, targets.pointId]
                    ]
                });
            }
            else if(targets.linkTo || targets.linkFrom){
                // create a new point on the link
                let point = this.addPoint(targets.linkId, localMousePosition, targets.linkTo);
                // start dragging the point
                this.moveItems({
                    subType: 'movePoint',
                    targets,
                    points: [
                        [targets.linkId, point.id]
                    ]
                });
            }
            else{
                // a link element was clicked 
                // but not the line or point
                // so just ignore it 
                this.moveItems({
                    subType: 'moveCanvas'
                });
            }
        }
        else if(targets.canvas){
            this.moveItems({
                subType: 'moveCanvas'
            });
        }
        this.setState({
            mouseIsDown: true, 
            lastMousePosition: mousePosition,
        });
    };

    onMouseMove = (e) => {
        let { mouseIsDown, lastMousePosition, action, data } = this.state;
        if(!mouseIsDown){ return; }
        if(!action){ return; }
        let zoom = data.diagram.zoom || 1;
        let currentMousePosition = {x:e.clientX, y:e.clientY};
        if(action.type === 'moveItems'){
            // if moving something
            let {nodes, points, subType} = action;
            if(subType === 'moveCanvas'){
                let diagram = this.state.data.diagram;
                let x = diagram.x - ((lastMousePosition.x - currentMousePosition.x))
                let y = diagram.y - ((lastMousePosition.y - currentMousePosition.y))
                this.setData(['diagram'], {x, y})
            }
            else{
                if(nodes && nodes.length){
                    // update the position of nodes that should move
                    this.setNode(nodes.map(id => {
                        let node = this.getNode(id);
                        return {
                            id, 
                            x: node.x + (currentMousePosition.x - lastMousePosition.x) / zoom,
                            y: node.y + (currentMousePosition.y - lastMousePosition.y) / zoom,
                        }
                    }))
                }
                if(points && points.length){
                    // save the position of nodes that should move.
                    // we render them in the next cycle via 'componentDidUpdate'
                    points.map(([linkId, pointId]) => {
                        let point = this.getPoint(linkId, pointId);
                        this.updatedPoints[`${linkId}:${pointId}`] = {
                            id: pointId, 
                            x: point.x + (currentMousePosition.x - lastMousePosition.x) / zoom,
                            y: point.y + (currentMousePosition.y - lastMousePosition.y) / zoom,
                        }
                    });
                }
            }
        }
        this.setState({
            lastMousePosition: currentMousePosition
        });
    };

    onMouseUp = (e) => {
        let {action} = this.state;
        if(action){
            // what is under the mouse?
            let {portId, nodeId} = utils.getTargets(e.target);
            let {type, points, targets, nodes, subType} = action;

            // if it's a port inside a node
            if(portId && nodeId){
                // if the user is dragging something
                if(type === 'moveItems'){
                    // if it's a link that was just created
                    if(subType === 'createLink'){

                        //* A new link connects to a port

                        // get the new link
                        let [linkId, pointId] = points[0];
                        let link = this.getLink(linkId);
                        
                        // if the end port is the start port
                        // delete the link
                        let [fromNode, fromPort] = link.fromPort;
                        if(nodeId === fromNode && portId === fromPort){
                            this.setData(['links'], links => links.filter(l => l.id !== linkId));
                        }
                        // else connect the link to the port
                        else{
                            // set the end port of the link
                            this.setLink({
                                id: linkId,
                                points: [],
                                toPort: [nodeId, portId],
                                endPoint: this.getPortCenter(nodeId, portId)
                            });

                            // add the link to the port's links
                            let node = this.getNode(nodeId);
                            let ports = [...node.ports];
                            let portIndex = node.ports.findIndex(p => p.id === portId);
                            let port = ports[portIndex];
                            ports[portIndex] = {
                                ...port,
                                links: (port.links || []).concat(linkId)
                            }
                            this.setNode([{ id: nodeId, ports }]);
                        }
                    }
                    else if(subType === 'movePoint'){

                        //* A link's point was dropped on a node's port

                        // get the link and it's ports
                        let [linkId, pointId] = points[0];
                        let link = this.getLink(linkId);
                        let [fromNode, fromPort] = link.fromPort;

                        // get the node at the end of the link
                        let toPort = link.toPort;
                        let startNode = this.getNode(fromNode);
                        let endNode = toPort && this.getNode(toPort[0]);

                        //? if it's the only point on the link and the link is not connected
                        if(link.points.length === 1 && !toPort){
                            // if the end port is the start port
                            if(nodeId === fromNode && portId === fromPort){
                                // delete the link
                                console.log(1)
                                this.setData(['links'], links => links.filter(l => l.id !== linkId));
                            }
                            else{
                                console.log(2)
                                // connect the link to the node's port
                                this.setLink({
                                    id: linkId,
                                    toPort: [nodeId, portId],
                                    endPoint: this.getPortCenter(nodeId, portId)
                                });
                                // connect the node's port to the link
                                let ports = [...startNode.ports];
                                let portIndex = startNode.ports.findIndex(p => p.id === portId);
                                let port = ports[portIndex];
                                ports[portIndex] = {
                                    ...port,
                                    links: (port.links || []).filter(t => t !== linkId).concat(linkId)
                                }
                                this.setNode([
                                    { id: nodeId, ports },
                                ]);
                            }
                        }
                        //? if the point was dropped on the start port
                        else if((nodeId === fromNode) && (portId === fromPort)){
                            // delete the point
                            this.setData(['links', {id: linkId}, 'points'], points => points.filter(p => p.id !== pointId));
                        }
                        //? if the point was dropped on the end port
                        else if((nodeId === toPort[0]) && (portId === toPort[1])){
                            // delete the point
                            this.setData(['links', {id: linkId}, 'points'], points => points.filter(p => p.id !== pointId));
                        }
                        //? if the point was dropped on different port
                        else{
                            console.log(3)
                            // we split the link into two links
                            // and connect both to the port
                            let newLinkId = utils.uuid();
                            let pointsA = [];
                            let pointsB = [];
                            let isB = false;

                            link.points.map((point, i) => {
                                if(point.id === pointId){
                                    return isB = true;
                                }
                                (isB ? pointsB : pointsA).push(point);
                            });
                            
                            this.setLink({
                                id: linkId,
                                points: pointsA,
                                toPort: [nodeId, portId],
                                endPoint: this.getPortCenter(nodeId, portId)
                            });
                            this.addLink({
                                ...link,
                                id: newLinkId,
                                fromPort: [nodeId, portId],
                                points: pointsB,
                                startPoint: this.getPortCenter(nodeId, portId)
                            });

                            // add both links to the current port
                            let node = this.getNode(nodeId);
                            let ports = [...node.ports];
                            let portIndex = node.ports.findIndex(p => p.id === portId);
                            let port = ports[portIndex];
                            ports[portIndex] = {
                                ...port,
                                links: (port.links || []).filter(t => t !== linkId).concat(pointsB.length ? [linkId, newLinkId] : [linkId])
                            }

                            // if the link is connected at the end
                            // change the link on the port 
                            // at the end of the link
                            if(endNode){
                                let endNodePorts = [...endNode.ports];
                                portIndex = endNodePorts.findIndex(p => p.id === toPort[1]);
                                port = endNodePorts[portIndex];
                                endNodePorts[portIndex] = {
                                    ...port,
                                    links: (port.links || []).filter(t => t !== linkId).concat(newLinkId)
                                }

                                this.setNode([
                                    { id: nodeId, ports },
                                    { id: endNode.id, ports: endNodePorts }
                                ]);
                            }
                            else{

                            }
                        }
                    }
                }
            }
        }
        
        this.setState({mouseIsDown: false, action: null});
    };

    onMouseWheel = (e) => {
        // zoom in or out when the mouse wheel is turned
        let { diagram } = this.state.data;
        let oldZoom = diagram.zoom || 1;
        // increase or decrease the zoom
        let diff = e.deltaY / 1000;
        let zoom = oldZoom * (1 + diff);
        // this makes the zooming point the mouse position
        let position = this.getLocalPosition(e);
        let nextPosition = this.getLocalPosition(e, zoom);
        let x = diagram.x + (nextPosition.x - position.x) * zoom; // - diagram.x * diff;
        let y = diagram.y + (nextPosition.y - position.y) * zoom; // - diagram.y * diff;
        if(e.deltaY){
            this.setData(['diagram'], {zoom, x, y})
        }
    };
    
    getBoundingRect = () => {
        return this.refs.root.getBoundingClientRect();
    };

    updateData = (data) => {
        this.setState({
            data: {
                ...this.state.data,
                ...data
            }
        });
    };

    setData = (selector, data) => {
        let newData = utils.set(this.state.data, selector, data);
        this.setState({
            data: newData
        });
        return newData;
    };
    
    setNode = (node) => {
        if(!node){return;}
        // accepts an array of nodes
        let nodes = Array.isArray(node) ? node : [node];
        if(!nodes.length){return;}
        this.setData(['nodes'], existingNodes => existingNodes.map(n => {
            node = nodes.find(n2 => n.id === n2.id);
            if(node){
                n = { ...n, ...node };
                this.updatedNodes[n.id] = n;
            }
            return n
        }));
    };
    
    setLink = (link) => {
        this.setData(['links', {id: link.id}], link)
    };

    setPort = (nodeId, port) => {
        let node = this.getNode(nodeId);
        let ports = [...node.ports];
        let portIndex = ports.findIndex(p => p.id === port.id);
        ports[portIndex] = port;
        this.setNode([
            { id: nodeId, ports }
        ]);
    };

    addLink = (link) => {
        let { links = [], nodes = [] } = this.state.data;
        link = utils.withId(link);
        let [nodeId, portId] = link.fromPort;
        this.updateData({
            links: links.concat(link),
            nodes: nodes.map(node => {
                if(node.id === nodeId){
                    return {
                        ...node,
                        ports: node.ports.map(port => {
                            if(port.id === portId){
                                return {
                                    ...port,
                                    links: (port.links || []).concat(link.id)
                                }
                            }
                        })
                    }
                }
                return node;
            })
        });
        return link;
    };
    addPoint = (linkId, point, linkTo) => {
        point = utils.withId(point);
        let link = this.getLink(linkId);
        if(link){
            this.setData(['links', {id: linkId}, 'points'], (points) => {
                points = [...points];
                if(linkTo){
                    let index = points.findIndex(p => p.id === linkTo);
                    if(index !== -1){
                        points.splice(index, 0, point);
                    }
                }
                else{
                    points.push(point);
                }
                return points;
            });
        }
        return point;
    };

    getNode = (nodeId) => {
        return this.state.data.nodes.find(n => n.id === nodeId);
    };

    getLink = (linkId) => {
        return this.state.data.links.find(l => l.id === linkId);
    };

    getPoint = (linkId, pointId) => {
        let points, links = this.state.data.links;
        for (let i = 0; i < links.length; i++) {
            points = (links[i].points || []);
            let point = points.find(p => p.id === pointId);
            if(point){ return point; }
        }
    };

    getPort = () => {};

    

    getPortCenter = (nodeId, portId) => {
        let {data} = this.state;
        let portElement = this.refs.root.querySelector(`[data-node-id=${nodeId}] [data-port-id=${portId}]`);
        let position = utils.getElementCenter(portElement);
        let zoom = data.diagram.zoom;
        let x = (position.x - data.diagram.x) / zoom;
        let y = (position.y - data.diagram.y) / zoom;
        return {x, y};
    };
    render(){
        let {data} = this.state;
        let {nodes = [], links = [], diagram} = data;
        let {x,y,zoom} = diagram;
        let transform = `translate(${x}px,${y}px) scale(${zoom})`;
        return (
            <div 
                ref="root"
                data-canvas
                style={{
                    width: '100%', 
                    height: '100%', 
                    flex: 1, 
                    position: 'relative',
                    overflow: 'hidden'                   
                }}
                onMouseDown={this.onMouseDown}
                onWheel={this.onMouseWheel}
            >
                <div style={{ position: 'absolute', transform }}>
                    {links.length ? <Links ref="links" links={links} diagram={this}/> : null}
                </div>
                <div style={{ position: 'absolute', transform }}>
                    <Nodes ref="nodes" nodes={nodes} diagram={this}/>
                </div>
                <div style={{position: 'absolute', top: 0, left: 100}}>
                    x: <input type="number" style={{width: 40 }}value={x} onChange={e => this.setData(['diagram', 'x'], parseInt(e.target.value))}/>
                    y: <input type="number" style={{width: 40 }}value={y} onChange={e => this.setData(['diagram', 'y'], parseInt(e.target.value))}/>
                    z: <input type="number" style={{width: 40 }}value={zoom} onChange={e => this.setData(['diagram', 'zoom'], parseFloat(e.target.value))}/>
                </div>
            </div>
        );
    }
}