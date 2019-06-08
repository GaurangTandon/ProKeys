import { PRIMITIVES_EXT_KEY } from "./pre";

const protoExtensions = {};

function setNodeListPropPerWindow(prop, func, win) {
    // in case of custom created array of Nodes, Array.prototype is necessary
    win.Array.prototype[prop] = win.NodeList.prototype[prop] = win.HTMLCollection.prototype[
        prop
    ] = function (...args) {
        // HTMLCollection, etc. doesn't support forEach
        for (let i = 0, len = this.length; i < len; i++) {
            func.apply(this[i], args);
        }

        return this;
    };

    win.Node.prototype[prop] = func;
}

/**
 * extends NodeList prototype per iframe present in the webpage
 * @type {Function}
 */
function updateAllValuesPerWin(win) {
    for (const [name, func] of Object.entries(protoExtensions)) {
        setNodeListPropPerWindow(name, func, win);
    }
    win[PRIMITIVES_EXT_KEY] = true;
}

/**
 * extends protoype of Node, Array and NodeList
 * @param {String} prop property to extend
 * @param {Function} func function to execute per for each Node
 */
function extendNodePrototype(prop, func) {
    protoExtensions[prop] = func;
}

export { extendNodePrototype, updateAllValuesPerWin };
