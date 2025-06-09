import { Severity } from '@google-cloud/logging';
import axios, { AxiosResponse } from 'axios';

import { SensorData } from '../interfaces/data.interface';
import gcpLogger from '../utils/gcp/gcp-logger';

export class DataService {
  private static readonly TIMEOUT = 10000; // 10 seconds
  private static readonly MAX_RETRIES = 3;

  /**
   * Sends data to an endpoint
   */
  static async sendToEndpoint(
    endpoint: string,
    data: SensorData,
    retryCount = 0
  ): Promise<boolean> {
    try {
      console.log(
        `📤 Sending data from sensor ${data.MACAddress} to ${endpoint}`
      );

      const response: AxiosResponse = await axios.post(endpoint, data, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'IoT-Simulator/1.0',
        },
        timeout: this.TIMEOUT,
      });

      if (response.status >= 200 && response.status < 300) {
        console.log(
          `✅ Success sending ${data.MACAddress} to ${endpoint} (${response.status})`
        );
        return true;
      }
      console.warn(
        `⚠️ Unexpected response ${response.status} for ${data.MACAddress}`
      );
      return false;
    } catch (error) {
      console.error(
        `❌ Error sending ${data.MACAddress} to ${endpoint}:`,
        error.message
      );

      // Retry logic
      if (retryCount < this.MAX_RETRIES) {
        console.log(
          `🔄 Retry ${retryCount + 1}/${this.MAX_RETRIES} for ${
            data.MACAddress
          }`
        );
        await new Promise((resolve) => {
          setTimeout(resolve, 1000 * (retryCount + 1));
        });
        return this.sendToEndpoint(endpoint, data, retryCount + 1);
      }

      return false;
    }
  }

  /**
   * Sends data to all endpoints
   */
  static async sendToAllEndpoints(
    endpoints: string[],
    data: SensorData
  ): Promise<number> {
    const promises = endpoints.map((endpoint) =>
      this.sendToEndpoint(endpoint, data)
    );

    gcpLogger({
      fileLink: __filename,
      message: `Sensor input Data`,
      payload: {
        data,
      },
      severity: Severity.info,
      withCloudRunInfos: true,
    });

    const results = await Promise.allSettled(promises);
    const successCount = results.filter(
      (result) => result.status === 'fulfilled' && result.value === true
    ).length;

    return successCount;
  }
}

export default DataService;
