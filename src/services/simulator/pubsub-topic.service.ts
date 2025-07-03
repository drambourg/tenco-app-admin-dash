import { PubSub } from '@google-cloud/pubsub';

import { SensorData } from '../../interfaces/data.interface';

export class PubSubService {
  private static pubSubClient: PubSub | null = null;
  private static readonly MAX_RETRIES = 3;

  private static getPubSubClient(): PubSub {
    if (!this.pubSubClient) {
      this.pubSubClient = new PubSub();
    }
    return this.pubSubClient;
  }

  static async publishToTopic(
    topicName: string,
    sensorData: SensorData,
    retryCount = 0
  ): Promise<boolean> {
    try {
      console.log(
        `📡 Publishing ${sensorData.MACAddress} to topic ${topicName}`
      );

      const pubSubClient = this.getPubSubClient();
      const topic = pubSubClient.topic(topicName);

      const dataBuffer = Buffer.from(JSON.stringify(sensorData));
      const attributes = {
        macAddress: sensorData.MACAddress,
        source: 'iot-simulator',
        timestamp: sensorData.timestamp.toString(),
      };

      const messageId = await topic.publishMessage({
        attributes,
        data: dataBuffer,
      });

      console.log(`✅ Published to ${topicName}, ID: ${messageId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error publishing to ${topicName}:`, error.message);

      if (retryCount < this.MAX_RETRIES) {
        console.log(`🔄 Retry ${retryCount + 1}/${this.MAX_RETRIES}`);
        await new Promise((resolve) => {
          setTimeout(resolve, 1000 * (retryCount + 1));
        });
        return this.publishToTopic(topicName, sensorData, retryCount + 1);
      }

      return false;
    }
  }
}

export default PubSubService;
