import { NpcActionPlugin } from '@server/world/actor/player/action/npc-action';
import { ObjectActionPlugin } from '@server/world/actor/player/action/object-action';
import { ButtonActionPlugin } from '@server/world/actor/player/action/button-action';
import { ItemOnItemActionPlugin } from '@server/world/actor/player/action/item-on-item-action';
import { CommandActionPlugin } from '@server/world/actor/player/action/input-command-action';
import { WidgetActionPlugin } from '@server/world/actor/player/action/widget-action';

export enum ActionType {
    BUTTON = 'button',
    WIDGET_ACTION = 'widget_action',
    ITEM_ON_ITEM = 'item_on_item',
    NPC_ACTION = 'npc_action',
    OBJECT_ACTION = 'object_action',
    COMMAND = 'command'
}

export interface ActionPlugin {
    type: ActionType;
}

export class RunePlugin {

    public actions: (NpcActionPlugin | ObjectActionPlugin | ButtonActionPlugin | ItemOnItemActionPlugin |
        CommandActionPlugin | WidgetActionPlugin)[];

    public constructor(actions: NpcActionPlugin | ObjectActionPlugin | ButtonActionPlugin | ItemOnItemActionPlugin |
        CommandActionPlugin | WidgetActionPlugin |
        (NpcActionPlugin | ObjectActionPlugin | ButtonActionPlugin | ItemOnItemActionPlugin |
            CommandActionPlugin | WidgetActionPlugin)[]) {
        if(!Array.isArray(actions)) {
            this.actions = [actions];
        } else {
            this.actions = actions;
        }
    }

}
