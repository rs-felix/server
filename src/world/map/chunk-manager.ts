import { Chunk } from './chunk';
import { Position } from '../position';
import { gameCache } from '../../game-server';
import { logger } from '@runejs/logger';
import { LandscapeObject } from '@runejs/cache-parser';
import { Item } from '@server/world/items/item';
import { Player } from '@server/world/actor/player/player';
import { WorldItem } from '@server/world/items/world-item';
import { World } from '@server/world/world';

/**
 * Controls all of the game world's map chunks.
 */
export class ChunkManager {

    private readonly chunkMap: Map<string, Chunk>;

    public constructor() {
        this.chunkMap = new Map<string, Chunk>();
    }

    public removeWorldItem(worldItem: WorldItem): void {
        const chunk = this.getChunkForWorldPosition(worldItem.position);
        chunk.removeWorldItem(worldItem);
        worldItem.removed = true;
        this.deleteWorldItemForPlayers(worldItem, chunk);
    }

    public spawnWorldItem(item: Item, position: Position, initiallyVisibleTo?: Player, expires?: number): WorldItem {
        const chunk = this.getChunkForWorldPosition(position);
        const worldItem: WorldItem = {
            itemId: item.itemId,
            amount: item.amount,
            position,
            initiallyVisibleTo,
            expires
        };

        chunk.addWorldItem(worldItem);

        if(initiallyVisibleTo) {
            initiallyVisibleTo.outgoingPackets.setWorldItem(worldItem, worldItem.position);
            setTimeout(() => {
                if(worldItem.removed) {
                    return;
                }

                this.spawnWorldItemForPlayers(worldItem, chunk, initiallyVisibleTo);
                worldItem.initiallyVisibleTo = undefined;
            }, 100 * World.TICK_LENGTH);
        } else {
            this.spawnWorldItemForPlayers(worldItem, chunk);
        }

        if(expires) {
            setTimeout(() => {
                if(worldItem.removed) {
                    return;
                }

                this.removeWorldItem(worldItem);
            }, expires * World.TICK_LENGTH);
        }

        return worldItem;
    }

    private spawnWorldItemForPlayers(worldItem: WorldItem, chunk: Chunk, excludePlayer?: Player): Promise<void> {
        return new Promise(resolve => {
            const nearbyPlayers = this.getSurroundingChunks(chunk).map(chunk => chunk.players).flat();

            nearbyPlayers.forEach(player => {
                if(excludePlayer && excludePlayer.equals(player)) {
                    return;
                }

                player.outgoingPackets.setWorldItem(worldItem, worldItem.position);
            });

            resolve();
        });
    }

    private deleteWorldItemForPlayers(worldItem: WorldItem, chunk: Chunk): Promise<void> {
        return new Promise(resolve => {
            const nearbyPlayers = this.getSurroundingChunks(chunk).map(chunk => chunk.players).flat();

            nearbyPlayers.forEach(player => {
                player.outgoingPackets.removeWorldItem(worldItem, worldItem.position);
            });

            resolve();
        });
    }

    public toggleObjects(newObject: LandscapeObject, oldObject: LandscapeObject, newPosition: Position, oldPosition: Position,
                         newChunk: Chunk, oldChunk: Chunk, newObjectInCache: boolean): void {
        if(newObjectInCache) {
            this.deleteRemovedObjectMarker(newObject, newPosition, newChunk);
            this.deleteAddedObjectMarker(oldObject, oldPosition, oldChunk);
        }

        this.addLandscapeObject(newObject, newPosition);
        this.removeLandscapeObject(oldObject, oldPosition);
    }

    public deleteAddedObjectMarker(object: LandscapeObject, position: Position, chunk: Chunk): void {
        chunk.addedLandscapeObjects.delete(`${position.x},${position.y},${object.objectId}`);
    }

    public deleteRemovedObjectMarker(object: LandscapeObject, position: Position, chunk: Chunk): void {
        chunk.removedLandscapeObjects.delete(`${position.x},${position.y},${object.objectId}`);
    }

    public addTemporaryLandscapeObject(object: LandscapeObject, position: Position, expireTicks: number): Promise<void> {
        return new Promise(resolve => {
            this.addLandscapeObject(object, position);

            setTimeout(() => {
                this.removeLandscapeObject(object, position, false)
                    .then(chunk => this.deleteAddedObjectMarker(object, position, chunk));
                resolve();
            }, expireTicks * World.TICK_LENGTH);
        });
    }

    public removeLandscapeObjectTemporarily(object: LandscapeObject, position: Position, expireTicks: number): Promise<void> {
        const chunk = this.getChunkForWorldPosition(position);
        chunk.removeObject(object, position);

        return new Promise(resolve => {
            const nearbyPlayers = this.getSurroundingChunks(chunk).map(chunk => chunk.players).flat();

            nearbyPlayers.forEach(player => {
                player.outgoingPackets.removeLandscapeObject(object, position);
            });

            setTimeout(() => {
                this.deleteRemovedObjectMarker(object, position, chunk);
                this.addLandscapeObject(object, position);
                resolve();
            }, expireTicks * World.TICK_LENGTH);
        });
    }

    public removeLandscapeObject(object: LandscapeObject, position: Position, markRemoved: boolean = true): Promise<Chunk> {
        const chunk = this.getChunkForWorldPosition(position);
        chunk.removeObject(object, position, markRemoved);

        return new Promise(resolve => {
            const nearbyPlayers = this.getSurroundingChunks(chunk).map(chunk => chunk.players).flat();

            nearbyPlayers.forEach(player => {
                player.outgoingPackets.removeLandscapeObject(object, position);
            });

            resolve(chunk);
        });
    }

    public addLandscapeObject(object: LandscapeObject, position: Position): Promise<void> {
        const chunk = this.getChunkForWorldPosition(position);
        chunk.addObject(object, position);

        return new Promise(resolve => {
            const nearbyPlayers = this.getSurroundingChunks(chunk).map(chunk => chunk.players).flat();

            nearbyPlayers.forEach(player => {
                player.outgoingPackets.setLandscapeObject(object, position);
            });

            resolve();
        });
    }

    public generateCollisionMaps(): void {
        logger.info('Generating game world collision maps...');

        const tileList = gameCache.mapRegions.mapRegionTileList;

        for(const tile of tileList) {
            const position = new Position(tile.x, tile.y, tile.level);
            const chunk = this.getChunkForWorldPosition(position);
            chunk.addTile(tile, position);
        }

        const objectList = gameCache.mapRegions.landscapeObjectList;

        for(const landscapeObject of objectList) {
            const position = new Position(landscapeObject.x, landscapeObject.y, landscapeObject.level);
            const chunk = this.getChunkForWorldPosition(position);
            chunk.setCacheLandscapeObject(landscapeObject, position);
        }

        logger.info('Game world collision maps generated.', true);
    }

    public getSurroundingChunks(chunk: Chunk): Chunk[] {
        const chunks: Chunk[] = [];

        const mainX = chunk.position.x;
        const mainY = chunk.position.y;
        const level = chunk.position.level;

        for(let x = mainX - 2; x <= mainX + 2; x++) {
            for(let y = mainY - 2; y <= mainY + 2; y++) {
                chunks.push(this.getChunk({ x, y, level }));
            }
        }

        return chunks;
    }

    public getChunkForWorldPosition(position: Position): Chunk {
        return this.getChunk({ x: position.chunkX, y: position.chunkY, level: position.level });
    }

    public getChunk(position: Position | { x: number, y: number, level: number }): Chunk {
        if(!(position instanceof Position)) {
            position = new Position(position.x, position.y, position.level);
        }

        const pos = (position as Position);

        if(this.chunkMap.has(pos.key)) {
            return this.chunkMap.get(pos.key);
        } else {
            const chunk = new Chunk(pos);
            this.chunkMap.set(pos.key, chunk);
            return chunk;
        }
    }

}
