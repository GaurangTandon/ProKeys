class TrieNode {
    constructor(value) {
        this.val = value;
        this.map = {};
        this.isEnd = false;
    }

    insert(str) {
        let currNode = this;
        for (const char of str) {
            if (!currNode.map[char]) { currNode.map[char] = new TrieNode(char); }
            currNode = currNode.map[char];
        }

        currNode.isEnd = true;
    }


    erase(str) {
        let currNode = this,
            prevNode = this,
            lastchar;
        for (const char of str) {
            lastchar = char;
            prevNode = currNode;
            currNode = currNode.map[char];
            if (!currNode) {
                throw new Error(`Trying to delete ${str}, but no node found after ${char}`);
            }
        }
        currNode.isEnd = false;
        prevNode.map[lastchar] = undefined;
    }
}

class SnipTrie {
    constructor() {
        this.trie = new TrieNode();
    }

    /**
     * @param {String} snipname
     */
    static wrapperFn(snipname) {
        let str = "";
        for (const char of snipname) { str = char + str; }
        return str;
    }

    /**
     *
     * @param {String} snipname
     */
    insert(snipname) {
        this.trie.insert(SnipTrie.wrapperFn(snipname));
    }

    /**
     * @param {Array<String>} snipnamelist
     */
    delete(snipnamelist) {
        for (const snipname of snipnamelist) {
            this.trie.delete(SnipTrie.wrapperFn(snipname));
        }
    }

    /**
     * @param {TrieNode} trieNode
     * @param {String} char
     */
    static moveForward(trieNode, char) {
        const nxt = trieNode.map[char];
        return nxt;
    }
}

export { SnipTrie };
