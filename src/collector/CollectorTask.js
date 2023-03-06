import constants from "../../util/constants";
import ActiveCollector from "./ActiveCollector";
import PassiveCollector from "./PassiveCollector";
import AgentCollector from "./AgentCollector";
import MongoProvider from "../MongoProvider";
let mongoProvider = new MongoProvider();

// collector data object
class Collector {
  constructor(json) {
    // common
    this._id = json._id;
    this.ts = json.ts;
    this.name = json.name;
    this.category = json.category; // active, passive
    this.type = json.type; // active: interval, timer; passive: file_tail, net_cap
    this.cmd = json.cmd;
    this.param = json.param;
    this.host = json.host;
    this.encoding = json.encoding;
    this.channel = json.channel;
    this.desc = json.desc;

    if (this.category == "active") {
      this.trigger = json.trigger;
    }
  }
} // class Collector

// collector runtime object
class CollectorTask extends Collector {
  constructor({ collectorJson }) {
    super(collectorJson);

    switch (collectorJson.category) {
      case "active":
        this.task = new ActiveCollector({
          collectorJson: this,
        });
        break;

      case "passive":
        this.task = new PassiveCollector({
          collectorJson: this,
        });
        break;

      case "agent":
        this.task = new AgentCollector({
          collector: this,
        });
        break;

      default:
        return NULL;
    }

    return this;
  }

  work() {
    /*
    if (this.channel == 'Nanomsg Queue') {
      let prefix = ''
      let errPrefix = ''
      if (this.category == 'active') {
        prefix = constants.ACTIVE_COLLECTOR_PREFIX
        errPrefix = constants.ACTIVE_COLLECTOR_ERROR_PREFIX
      }
      else {
        prefix = constants.PASSIVE_COLLECTOR_PREFIX
        errPrefix = constants.PASSIVE_COLLECTOR_ERROR_PREFIX
      }

      // console.log('register', prefix + this.name)

      this.task.nanomsgQueueProvider.register(prefix + this.name)
      this.task.nanomsgQueueProvider.register(errPrefix + this.name)
    }
    */

    this.task.start();
  }

  rest() {
    /*
    if (this.channel == 'Nanomsg Queue') {
      let prefix = ''
      let errPrefix = ''
      if (this.category == 'active') {
        prefix = constants.ACTIVE_COLLECTOR_PREFIX
        errPrefix = constants.ACTIVE_COLLECTOR_ERROR_PREFIX
      }
      else {
        prefix = constants.PASSIVE_COLLECTOR_PREFIX
        errPrefix = constants.PASSIVE_COLLECTOR_ERROR_PREFIX
      }

      // console.log('unregister', prefix + this.name)

      this.task.nanomsgQueueProvider.unregister(prefix + this.name)
      this.task.nanomsgQueueProvider.unregister(errPrefix + this.name)
    }
    */

    this.task.stop();
  }

  getActivityInfo() {
    return this.task.getLastActivity();
  }

  getRunningFlag() {
    return this.task.getRunningFlag();
  }
} // class CollectorTask

export { Collector, CollectorTask };
