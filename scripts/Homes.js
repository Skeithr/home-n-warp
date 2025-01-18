import { world, system } from '@minecraft/server';
import { ActionFormData, MessageFormData, ModalFormData } from '@minecraft/server-ui';
class home {
    constructor(dim, hName, x, y, z) {
        this.dimension = dim;
        this.name = hName;
        this.locX = x;
        this.locY = y;
        this.locZ = z;
    }
}
function setHome(player, playerLoc, homeName = "Main") {
    if (!homeName)
        homeName = "Main";
    //player.sendMessage(player.dimension.id.substring(10));
    const homeToAdd = new home(player.dimension.id.substring(10), homeName, playerLoc.x, playerLoc.y, playerLoc.z);
    player.setDynamicProperty(`hnwh:${homeName}`, JSON.stringify(homeToAdd));
    player.sendMessage("§aHome successfully set.");
    // player.setDynamicProperty(`hnwh:${homeName}-Location`, playerLoc);
    // player.setDynamicProperty(`hnwh:${homeName}-Dimension`, player.dimension.id);
}
function toHome(player, dynamicProp) {
    if (player.getDynamicProperty(dynamicProp)) {
        const homeDest = JSON.parse(player.getDynamicProperty(dynamicProp).toString());
        let teleOpts = new Object();
        const theDim = world.getDimension(homeDest.dimension);
        teleOpts.dimension = world.getDimension(homeDest.dimension);
        teleOpts.checkForBlocks = false;
        teleOpts.keepVelocity = false;
        let loc = { x: homeDest.locX, y: homeDest.locY, z: homeDest.locZ };
        try {
            if (theDim.getBlock(loc)
                && theDim.getBlock(loc).isValid()
                && theDim.getBlock(loc).isAir
                && theDim.getBlock(loc).above().isAir
                && !theDim.getBlock(loc).below().isAir
                && !theDim.getBlock(loc).below().isLiquid) {
                player.teleport(loc, teleOpts);
            }
            else {
                teleAlert.show(player).then((o) => {
                    if (o.canceled || o.selection === 1)
                        return;
                    player.teleport(loc, teleOpts);
                });
            }
        }
        catch ({ name, message }) {
            player.sendMessage(`Home teleport failed. Error: ${message}`);
        }
    }
}
function getHomeList(player) {
    let dynamicProps = player.getDynamicPropertyIds();
    let arrToReturn = [];
    for (const prop of dynamicProps) {
        if (prop.includes("hnwh"))
            arrToReturn.push(prop);
    }
    return arrToReturn;
}
const teleAlert = new MessageFormData()
    .title("§e§lCAUTION: §r§eUnsafe home")
    .body("§e§iWarning!\n\nHome safety check failed.\n\nHome could be currently either unloaded, obstructed, missing a grounding block, or containing water/lava. Override and continue?")
    .button1("§aProceed")
    .button2("§4Cancel");
let homeMenu = new ActionFormData()
    .title("Your Homes");
const emptyMenu = new MessageFormData();
const namingHMenu = new ModalFormData()
    .title("New Home Name")
    .textField("Home name", "(Optional) Ex: Base")
    .submitButton("§aSet Home");
const mainMenu = new ActionFormData()
    .title("Home N Warp")
    .button("My Homes", "textures/blocks/stonebrick")
    .button("Set a Home")
    .button("World Warps")
    .button("Set a World Warp");
world.beforeEvents.itemUse.subscribe(event => {
    /*
    * Code for debugging
    * DELETE ME WHEN FINISHING
    */
    if (event.itemStack.typeId === "minecraft:arrow") {
        event.source.clearDynamicProperties();
        event.source.sendMessage("Properties cleared.");
        return;
    }
    // if (event.itemStack.typeId === "speedister:home_scepter")
    if (event.itemStack.typeId === "minecraft:stick") {
        const player = event.source;
        let homes = getHomeList(player);
        // if (homes.length < 1)
        // {
        //     homeMenu.body("No homes stored.");
        // }
        system.run(() => {
            mainMenu.show(player).then((s) => {
                if (s.canceled)
                    return;
                switch (s.selection) {
                    case 0:
                        if (homes.length < 1) {
                            emptyMenu.title("No Homes Set");
                            emptyMenu.body("No homes are recorded for this player. Set a new home here?");
                            emptyMenu.button1("§aYes - Set here");
                            emptyMenu.button2("§cNo - Cancel");
                            emptyMenu.show(player).then((n) => {
                                if (n.canceled || n.selection === 1)
                                    return;
                                namingHMenu.show(player).then((nameR) => {
                                    if (nameR.canceled)
                                        return;
                                    const [homeName] = nameR.formValues;
                                    setHome(player, player.location, homeName.toString());
                                });
                            });
                        }
                        else {
                            homeMenu = new ActionFormData()
                                .title("Your Homes");
                            for (const home of homes) {
                                homeMenu.button(home.substring(5));
                            }
                            homeMenu.show(player).then((h) => {
                                if (h.canceled)
                                    return;
                                toHome(player, homes[h.selection]);
                            });
                        }
                        break;
                    case 1:
                        namingHMenu.show(player).then((n) => {
                            if (n.canceled)
                                return;
                            const [homeName] = n.formValues;
                            setHome(player, player.location, homeName.toString());
                        });
                        break;
                    case 2:
                        break;
                    case 3:
                        break;
                    default:
                }
            });
            return;
        });
    }
});
