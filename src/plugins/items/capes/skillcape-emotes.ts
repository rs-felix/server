import { lockEmote, unlockEmote } from '@plugins/buttons/player-emotes-plugin';
import { equipActionHandler } from '@engine/world/action/equip.action';
import { itemIds } from '@engine/world/config/item-ids';

export const skillcapeIds: Array<number> = Object.keys(
    itemIds.skillCapes).flatMap(skill => [itemIds.skillCapes[skill].untrimmed, itemIds.skillCapes[skill].trimmed]
);

export const equip: equipActionHandler = (details) => {
    const { player } = details;
    unlockEmote(player, 'SKILLCAPE');
};

export const unequip: equipActionHandler = (details) => {
    const { player } = details;
    lockEmote(player, 'SKILLCAPE');
    player.stopAnimation();
    player.stopGraphics();
};

export default [{
    type: 'equip_action',
    equipType: 'EQUIP',
    action: equip,
    itemIds: skillcapeIds
}, {
    type: 'equip_action',
    equipType: 'UNEQUIP',
    action: unequip,
    itemIds: skillcapeIds
}];
