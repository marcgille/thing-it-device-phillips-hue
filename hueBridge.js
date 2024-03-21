module.exports = {
    metadata: {
        family: "philips-hue",
        plugin: "hueBridge",
        label: "Philips Hue Bridge",
        manufacturer: "Philips",
        discoverable: true,
        actorTypes: [],
        sensorTypes: [],
        services: [],
        state: [{
            id: "rooms",
            label: "Rooms",
            type:{
                id: "any"
            }
        }],
        configuration: [{
            id: "host",
            label: "Host",
            type: {
                id: "string"
            },
            default: "255.255.255.255"
        }, {
            id: "userName",
            label: "User Name",
            type: {
                id: "string"
            }
        }, {
            id: "port",
            label: "Port",
            type: {
                id: "integer"
            },
            default: "8080"
        }, {
            id: "timeout",
            label: "Timeout",
            type: {
                id: "integer"
            },
            default: "20000"
        }]
    },
    create: function () {
        return new HueBridge();
    },
    discovery: function () {
        return new HueBridgeDiscovery();
    }
};

var q = require('q');
var hue;

/**
 *
 * @constructor
 */
function HueBridgeDiscovery() {
    /**
     *
     * @param options
     */
    HueBridgeDiscovery.prototype.start = function () {
        if (this.node.isSimulated()) {
            this.timer = setInterval(function () {
                var hueBridge = new HueBridge();

                hueBridge.configuration = this.defaultConfiguration;
                hueBridge.configuration.host = "test";
                hueBridge.configuration.userName = "test";
                hueBridge.uuid = "09-99-23-56-78";

                hueBridge.actors = [];

                hueBridge.actors.push({
                    id: "lightBulb1", label: "Light Bulb 1", type: "lightBulb",
                    configuration: {
                        id: 1
                    }
                });

                this.logDebug("Bridge with lights", hueBridge);

                this.advertiseDevice(hueBridge);
            }.bind(this), 20000);
        } else {
            if (!hue) {
                hue = require("node-hue-api-v2-shim");
            }

            // TODO For now, need to be able to switch for Discovery or inherit from Device

            this.logLevel = "debug";

            this.timer = setInterval(function () {
                hue.nupnpSearch().then(function (bridges) {
                    for (var n in bridges) {
                        new hue.HueApi(bridges[n].ipaddress).registerUser(bridges[n].ipaddress, "thing-it", "[thing-it] Node Default User")
                            .then(function (user) {
                                this.logDebug("Hue API", user);

                                new hue.HueApi(bridges[n].ipaddress, user).fullState().then(function (bridge) {
                                    this.logDebug("Bridge", bridge);

                                    var hueBridge = new HueBridge();

                                    hueBridge.configuration = this.defaultConfiguration;
                                    hueBridge.configuration.host = bridge.config.ipaddress;
                                    hueBridge.configuration.userName = user;
                                    hueBridge.uuid = bridge.config.mac;

                                    // TODO Inherit structure from Device. Where is the device bound?

                                    hueBridge.actors = [];

                                    for (var n in bridge.lights) {
                                        if (bridge.lights[n].type === "Dimmable light") {
                                            hueBridge.actors.push({
                                                id: "light" + n, label: bridge.lights[n].name, type: "lightBulb",
                                                configuration: {
                                                    id: n
                                                }
                                            });
                                        }
                                        else if (bridge.lights[n].type === "Extended color light") {
                                            hueBridge.actors.push({
                                                id: "light" + n, label: bridge.lights[n].name, type: "livingColorLamp",
                                                configuration: {
                                                    id: n
                                                }
                                            });
                                        }
                                    }

                                    this.logDebug("Bridge with lights", hueBridge);
                                    this.advertiseDevice(hueBridge);
                                }.bind(this)).fail(function (error) {
                                    this.logError(error);
                                }.bind(this));
                            }.bind(this))
                            .fail(function (error) {
                                this.logError(error);
                            }.bind(this));
                    }
                }.bind(this)).fail(function (error) {
                    this.logError(error);
                });
            }.bind(this), 10000);
        }
    };

    /**
     *
     * @param options
     */
    HueBridgeDiscovery.prototype.stop = function () {
        if (this.timer) {
            clearInterval(this.timer);
        }
    };
}

/**
 *
 * @constructor
 */
function HueBridge() {
    /**
     *
     */
    HueBridge.prototype.start = function () {
        var deferred = q.defer();

        this.operationalState = {
            status: 'PENDING',
            message: 'Waiting for initialization...'
        };
        this.publishOperationalStateChange();

        if (this.isSimulated()) {
            this.operationalState = {
                status: 'OK',
                message: 'Philips Hue Bridge successfully initialized'
            }
            this.publishOperationalStateChange();

            deferred.resolve();
        } else {
            if (!hue) {
                hue = require('node-hue-api-v2-shim');
            }
            this.state = {
                rooms: []
            };
            setTimeout(function () {
                            console.log("Hue API", this.hueApi);
                        }, 10000);
            this.hueApi = hue.HueApi(this.configuration.host, this.configuration.userName);

            

            this.logInfo("Hue API", this.hueApi);

            this.hueApi.groups().then((groups) => {

                groups.forEach((room) => {

                    if (room.type === 'Room') {
                        this.state.rooms.push({id: room.id, name: room.name});
                    }
                });

                this.operationalState = {
                    status: 'OK',
                    message: 'Philips Hue Bridge successfully initialized'
                }
                this.publishOperationalStateChange();

                deferred.resolve();

            }).catch((error) => {
                this.operationalState = {
                    status: 'ERROR',
                    message: 'Philips Hue Bridge initialization error'
                }
                this.publishOperationalStateChange();

                this.logError("Error accessing Hue Bridge: ", JSON.stringify(error));
                deferred.reject(error);
            });

        }

        return deferred.promise;
    };

    /**
     *
     */
    HueBridge.prototype.stop = function () {
        var deferred = q.defer();

        deferred.resolve();

        return deferred.promise;
    };

    /**
     *
     */
    HueBridge.prototype.getState = function () {
        return this.state;
    };

    /**
     *
     */
    HueBridge.prototype.setState = function (state) {
        this.state = state;
    };
}
