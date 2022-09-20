import _ from 'lodash'

class FsmLut {
    constructor(scanInterval, scanCallback) {
        this.table = {}
        this.scanInterval = scanInterval
        this.scanCallback = scanCallback

        this.insert = this.insert.bind(this)
        this.lookup = this.lookup.bind(this)
        this.pop = this.pop.bind(this)
        this.update = this.update.bind(this)
        this.append = this.append.bind(this)
        this.clear = this.clear.bind(this)
        this.scan = this.scan.bind(this)

        // scanCallback({ key, value })
        if (this.scanInterval > 0 && this.scanCallback !== undefined) {
            this.scanProcessor = setInterval(this.scan, this.scanInterval)
        }
    }

    insert(key, state, data) {
        this.table[key] = { state, history: [ data ] }
    }

    lookup(key) {
        const result = _.cloneDeep(this.table[key])
        return result
    }

    pop(key) {
        const result = _.cloneDeep(this.table[key])
        delete this.table[key]
        return result
    }

    update(key, state) {
        const item = this.table[key]
        item.state = state
    }

    append(key, state, data) {
        const item = this.table[key]
        item.state = state
        item.history.push(data)
    }

    clear() {
        this.table = {}
    }

    scan() {
        // scan wrapper
        if (this.table !== undefined && this.table !== null) {
            Object.keys(this.table).map((key) => {
                const item = { key, value: this.table[key] }
                this.scanCallback(item, this)
            })
        }
    }

    get length() {
        return Object.keys(this.table).length
    }
}

export default FsmLut
