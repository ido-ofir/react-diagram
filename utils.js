
function typeOf(thing){
    var type = toString.call(thing);
    return type.substring(8, type.length -1).toLowerCase();
}

function match(a,b){
    for(var m in a){
        if(a[m] !== b[m]){
            return false;
        }
    }
    return true;
}

let utils = {
    typeOf,
    uuid(){
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
			const r = (Math.random() * 16) | 0;
			const v = c === "x" ? r : (r & 0x3) | 0x8;
			return v.toString(16);
		});
    },
    withId(item){
        if(item && !item.id){
            return {
                ...item,
                id: utils.uuid()
            }
        }
        return item;
    },
    generateLinkPath(from, to, curvy = 0){
        var isHorizontal = Math.abs(from.x - to.x) > Math.abs(from.y - to.y);
		var curvyX = isHorizontal ? curvy : 0;
		var curvyY = isHorizontal ? 0 : curvy;

		return `M${from.x},${from.y} C ${from.x + curvyX},${from.y + curvyY}
        ${to.x - curvyX},${to.y - curvyY} ${to.x},${to.y}`;
    },
    getElementCenter(element){
        if(element){
            let box = element.getBoundingClientRect();
            return {x: box.x + box.width / 2, y: box.y + box.height / 2};
        }
    },
    getTargets(element){
        let data = {};
        let walk = (el) => {
            if(!el){return;}
            let t = el.attributes;
            if(t['data-node-id']){
                data.nodeId = t['data-node-id'].value;
                return;
            }
            if(t['data-link-id']){
                data.linkId = t['data-link-id'].value;
                return;
            }
            if(t['data-port-id']){
                data.portId = t['data-port-id'].value;
            }            
            else if(t['data-point-id']){
                data.pointId = t['data-point-id'].value;
            }
            else if(t['data-link-to']){
                data.linkTo = t['data-link-to'].value;
            }
            else if(t['data-link-from']){
                data.linkFrom = t['data-link-from'].value;
            }
            else if(t['data-canvas']){
                data.canvas = true;
                return;
            }
            walk(el.parentElement);
        }
        walk(element);
        return data;
    },
    set(target, selector, data){
        let selectorType = typeOf(selector);
        let targetType = typeOf(target);

        if(selectorType === 'array'){
            // if it's the end of the query return the new value
            if(!selector.length){
                let dataType = typeOf(data);
                // if the new value is an object 
                // merge it with existing and return
                if(dataType === 'object'){
                    return {...target, ...data};
                }
                // if the new value is a function return it's result
                if(dataType === 'function'){
                    return data(target);
                }
                // else return the new value
                return data;
            }
            let key = selector[0];
            let keyType = typeOf(key);
            if(keyType === 'array'){
                // return key.map()
            }
            if(targetType === 'object'){
                // if the current selector item is a function
                // just return what it returns;
                if(keyType === 'function'){
                    return key(target)
                }
                // if the target is an object, 
                // return a new object
                // with the new property value under 'key'
                return {
                    ...target,
                    [key]: utils.set(
                        target[key],
                        selector.slice(1),
                        data
                    ) 
                };
            }
            if(targetType === 'array'){
                
                let nextTarget;
                if(keyType === 'function'){
                    nextTarget = target.find(key);
                }
                else if(keyType === 'object'){
                    nextTarget = target.find(item => match(key, item));
                }
                let index = target.indexOf(nextTarget);
                let result = [...target];
                result[index] = utils.set(
                    nextTarget,
                    selector.slice(1),
                    data
                )
                return result;
            }
            return data;
        }
    }
}

module.exports = utils;