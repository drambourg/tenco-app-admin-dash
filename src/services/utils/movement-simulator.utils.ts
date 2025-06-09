import { computeDestinationPoint, isPointInPolygon } from 'geolib';

import {
  BoundingBox,
  Position,
  SensorConfig,
} from '../../interfaces/data.interface';

export class MovementSimulator {
  private static readonly OFFSET_DISTANCE = 2; // meters offset

  /**
   * Calculates new position based on distance and direction using geolib
   */
  static movePosition(
    currentPosition: Position,
    direction: 'north' | 'south' | 'east' | 'west',
    distanceMeters: number
  ): Position {
    let bearing: number;
    switch (direction) {
      case 'north':
        bearing = 0;
        break;
      case 'east':
        bearing = 90;
        break;
      case 'south':
        bearing = 180;
        break;
      case 'west':
      default:
        bearing = 270;
        break;
    }

    const newPos = computeDestinationPoint(
      currentPosition,
      distanceMeters,
      bearing
    );

    return {
      latitude: newPos.latitude,
      longitude: newPos.longitude,
    };
  }

  /**
   * Checks if position is within bounding box using geolib
   */
  static isWithinBounds(position: Position, boundingBox: BoundingBox): boolean {
    const polygon = [
      { latitude: boundingBox.north, longitude: boundingBox.west },
      { latitude: boundingBox.north, longitude: boundingBox.east },
      { latitude: boundingBox.south, longitude: boundingBox.east },
      { latitude: boundingBox.south, longitude: boundingBox.west },
    ];

    return isPointInPolygon(position, polygon);
  }

  /**
   * Reverses direction when hitting boundary
   */
  static reverseDirection(
    direction: 'north' | 'south' | 'east' | 'west'
  ): 'north' | 'south' | 'east' | 'west' {
    switch (direction) {
      case 'north':
        return 'south';
      case 'south':
        return 'north';
      case 'east':
        return 'west';
      case 'west':
      default:
        return 'east';
    }
  }

  /**
   * Applies random offset of approximately 2m
   */
  static applyRandomOffset(position: Position): Position {
    const offsetAngle = Math.random() * 360; // Random angle
    const offsetDistance = this.OFFSET_DISTANCE;

    const newPos = computeDestinationPoint(
      position,
      offsetDistance,
      offsetAngle
    );

    return {
      latitude: newPos.latitude,
      longitude: newPos.longitude,
    };
  }

  /**
   * Applies reverse offset in opposite direction
   */
  static applyReverseOffset(
    position: Position,
    direction: 'north' | 'south' | 'east' | 'west'
  ): Position {
    let reverseBearing: number;
    switch (direction) {
      case 'north':
        reverseBearing = 180;
        break; // Go south
      case 'south':
        reverseBearing = 0;
        break; // Go north
      case 'east':
        reverseBearing = 270;
        break; // Go west
      case 'west':
      default:
        reverseBearing = 90;
        break; // Go east
    }

    const newPos = computeDestinationPoint(
      position,
      this.OFFSET_DISTANCE,
      reverseBearing
    );

    return {
      latitude: newPos.latitude,
      longitude: newPos.longitude,
    };
  }

  /**
   * Updates sensor position with enhanced boundary handling
   */
  static updateSensorPosition(
    sensor: SensorConfig,
    currentPosition: Position,
    boundingBox: BoundingBox
  ): {
    newPosition: Position;
    newDirection: 'north' | 'south' | 'east' | 'west';
  } {
    // Calculate new position
    let newPosition = this.movePosition(
      currentPosition,
      sensor.direction,
      sensor.speed
    );
    let newDirection = sensor.direction;

    // Check if we're going outside bounds
    if (!this.isWithinBounds(newPosition, boundingBox)) {
      console.log(
        `🚨 Sensor ${sensor.id} hitting boundary, reversing direction`
      );

      // Reverse direction
      newDirection = this.reverseDirection(sensor.direction);

      // Apply random offset
      const offsetPosition = this.applyRandomOffset(currentPosition);

      // Check if offset position is still within bounds
      if (!this.isWithinBounds(offsetPosition, boundingBox)) {
        console.log(
          `⚠️ Sensor ${sensor.id} offset goes outside bounds, applying reverse offset`
        );

        // Apply reverse offset instead
        const reverseOffsetPosition = this.applyReverseOffset(
          currentPosition,
          sensor.direction
        );

        // Calculate new position with reversed direction from reverse offset position
        if (this.isWithinBounds(reverseOffsetPosition, boundingBox)) {
          newPosition = this.movePosition(
            reverseOffsetPosition,
            newDirection,
            sensor.speed
          );
        } else {
          // Last resort: stay at current position
          console.log(
            `🛑 Sensor ${sensor.id} reverse offset also outside, staying in place`
          );
          newPosition = currentPosition;
        }
      } else {
        // Calculate new position with reversed direction from offset position
        newPosition = this.movePosition(
          offsetPosition,
          newDirection,
          sensor.speed
        );
      }

      // Final check - if still outside bounds, stay at current position
      if (!this.isWithinBounds(newPosition, boundingBox)) {
        console.log(
          `🔒 Sensor ${sensor.id} final position check failed, staying at current position`
        );
        newPosition = currentPosition;
      }
    }

    return { newDirection, newPosition };
  }
}

export default MovementSimulator;
