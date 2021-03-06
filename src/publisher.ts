import { IClientOptions, IClientPublishOptions } from "mqtt"
import MQTT, { AsyncMqttClient } from 'async-mqtt'
import { MqttConfig, Zones } from "./config"

export class Publisher {

    mqttClient: AsyncMqttClient;

    constructor(private config: MqttConfig, private zones: Zones) {
        const options = {
            will: {
                topic: `${config.baseTopic}/bridge/availability`,
                payload: 'offline',
                retain: true,
            },
            username: config.username,
            password: config.password,
            clientId: "SIA2MQTT4HA"
        } as IClientOptions

        this.mqttClient = MQTT.connect(config.brokerUrl, options)

        this.mqttClient.on("connect", () => {
            console.log("Connected to MQTT broker")
            this.publishOnline()
        })

        this.mqttClient.on("disconnect", () => {
            console.log("Disconnected from MQTT broker")
        })
    }

    private async publishOnline(): Promise<any> {
        const availability=[
            {
                topic: `${this.config.baseTopic}/bridge/availability`
            }
        ]

        // There is one device for SIA2MQTT4HA we call this sia2mqtt4ha_alarmpanel
        // All of the entities belong to this device
        let device = {
            identifiers: ["sia2mqtt4ha_alarmpanel"],
            name: "AlarmPanel",
            manufacturer: "SIA2MQTT4HA",
            model: "SIA2MQTT4HA App",
            sw_version: "0.1"//,
        }

        // These are the standard entities: set_status, alarm_status, comms_test and event
        // all which will appear in HA under $baseTopic and will have JSON formatted messages
        // published to them.
        // Todo: simplify this a bit - there's lots of duplication
        let entities = [
            {
                availability: availability,
                device: device,
                state_topic: `${this.config.baseTopic}/set_status`,
                json_attributes_topic: `${this.config.baseTopic}/set_status`,
                name: "Set Status",
                unique_id: "sia2mqtt4ha_alarmpanel_set_status",
                value_template: '{{ value_json.status }}',
                icon: "mdi:security"
            },
            {
                availability: availability,
                device: device,
                state_topic: `${this.config.baseTopic}/alarm_status`,
                json_attributes_topic: `${this.config.baseTopic}/alarm_status`,
                name: "Alarm Status",
                unique_id: "sia2mqtt4ha_alarmpanel_alarm_status",
                value_template: '{{ value_json.status }}',
                icon: "mdi:bell"
            },
            {
                availability: availability,
                device: device,
                state_topic: `${this.config.baseTopic}/comms_test`,
                json_attributes_topic: `${this.config.baseTopic}/comms_test`,
                name: "Comms Status",
                unique_id: "sia2mqtt4ha_alarmpanel_comms_test",
                value_template: '{{ value_json.status }}',
                icon: "mdi:check-network"
            },
            {
                availability: availability,
                device: device,
                state_topic: `${this.config.baseTopic}/event`,
                json_attributes_topic: `${this.config.baseTopic}/event`,
                name: "Event",
                unique_id: "sia2mqtt4ha_alarmpanel_event",
                value_template: '{{ value_json.code }}',
                icon: "mdi:flag"
            }
        ]

        // Add the Zone entities (as defined in the config file)
        let zoneEntities=[]
        for(let i in this.zones){
            let device_class
            let template
            if(this.zones[i].type.toUpperCase()=="DOOR"){
                device_class="door"
                template="contact"
            }else{
                device_class="motion"
                template="occupancy"
            }

            let zoneEntity={
                availability: availability,
                device: device,
                state_topic: `${this.config.baseTopic}/zone_${i}`,
                json_attributes_topic: `${this.config.baseTopic}/zone_${i}`,
                name: this.zones[i].name,
                unique_id: "sia2mqtt4ha_alarmpanel_zone_" + i,
                value_template: `{{ value_json.${template} }}`,
                device_class: device_class,
                payload_off: false,
                payload_on: true
            }

            zoneEntities.push(zoneEntity)
        }

        try {
            // Set our bridge availability to online
            await this.publish("bridge/availability", "online", true)

            // Advertise the presence of all standard entities so they can be discovered
            for (let entity in entities) {
                let thisEntity = entities[entity]
                let entityDiscoveryTopic = `${this.config.discoveryTopic}/sensor/${thisEntity.unique_id}/config`
                await this.publishJSONdiscovery(entityDiscoveryTopic, entities[entity], true)
            }

            // Advertise the presence of all zone entities so they can be discovered
            for (let entity in zoneEntities) {
                let thisEntity = zoneEntities[entity]
                let entityDiscoveryTopic = `${this.config.discoveryTopic}/binary_sensor/${thisEntity.unique_id}/config`
                await this.publishJSONdiscovery(entityDiscoveryTopic, zoneEntities[entity], true)
            }

            // Set initial statuses for standard entities
            await this.publishJSON("alarm_status", {status: "None yet", time: "00:00"}, true)
            await this.publishJSON("set_status", {status: "None yet", time: "00:00"}, true)
            await this.publishJSON("comms_test", {status: "None yet", time: "00:00"}, true)

        } catch (ex) {
            console.log(ex)
        }
    }

    public async publish(subTopic: string, data: string, retain?: boolean) {
        try {
            await this.mqttClient.publish(`${this.config.baseTopic}/${subTopic}`, data,
                {retain: retain||false} as IClientPublishOptions)
            //console.log("Published: " + `${this.config.baseTopic}/${subTopic}/${data}`)
        } catch (error) {
            console.log(error)
        }
    }

    public async publishJSON(subTopic: string, data: object, retain?: boolean) {
        try {
            await this.mqttClient.publish(`${this.config.baseTopic}/${subTopic}`, JSON.stringify(data),
                {retain: retain||false} as IClientPublishOptions)
            //console.log("Published JSON: " + `${this.config.baseTopic}/${subTopic}/${JSON.stringify(data)}`)
        } catch (error) {
            console.log(error)
        }
    }

    public async publishJSONdiscovery(discoveryTopic: string, data: object, retain?: boolean) {
        try {
            await this.mqttClient.publish(`${discoveryTopic}`, JSON.stringify(data),
                {retain: retain||false} as IClientPublishOptions)
            //console.log("Published Discovery: " + `${discoveryTopic}/${JSON.stringify(data)}`)
        } catch (error) {
            console.log(error)
        }
    }
}
