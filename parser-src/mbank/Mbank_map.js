import Parser from '../../lib/Parser'
import chalk from 'chalk'

class Mbank_map {
    constructor (parser) {
        this.parser = parser
        this.map  = new Map()

        this.add = this.add.bind(this)
        this.get = this.get.bind(this)
        this.delete = this.delete.bind(this)
    }
    add (msg) {
        var key = msg.key
        this.map.set(key,msg.message)
    }
    get(key) {
        return this.map.get(key)
    }
    delete(key) {
        this.map.delete(key)
    }
	  all() {
        for (let item of this.map.entries()) {
           console.log( chalk.green(item[0], item[1]) );
          }
    }
}
export default Mbank_map
