import {
    world,
    system,
    Player,
    Vector3,
    TeleportOptions,
} from "@minecraft/server";
import {
    ActionFormData,
    ActionFormResponse,
    MessageFormData,
    MessageFormResponse,
    ModalFormData,
    ModalFormResponse,
} from "@minecraft/server-ui";

const HOME_LIMIT = 3;
const WARP_LIMIT = 1;

class Home {
    id: number;
    name: string;
    dimension: string;
    locX: number;
    locY: number;
    locZ: number;
    constructor(dim: string, hName: string, x: number, y: number, z: number) {
        this.id = getID();
        this.name = hName;
        this.dimension = dim;
        this.locX = x;
        this.locY = y;
        this.locZ = z;
    }
}

class StorablePlayer {
    id: string;
    name: string;
    constructor(anId: string, aName: string) {
        this.id = anId;
        this.name = aName;
    }
}

class Warp {
    id: number;
    name: string;
    owner: StorablePlayer;
    dimension: string;
    locX: number;
    locY: number;
    locZ: number;
    defaultWarp: boolean;
    constructor(
        dim: string,
        owner: Player,
        hName: string,
        x: number,
        y: number,
        z: number,
        defWarp: boolean
    ) {
        this.id = getID();
        this.name = hName;
        this.owner = new StorablePlayer(owner.id, owner.name);
        this.dimension = dim;
        this.locX = x;
        this.locY = y;
        this.locZ = z;
        this.defaultWarp = defWarp;
    }
}

function delHome(player: Player, home: Home): boolean {
    const listOfHomes = getHomeList(player);
    if (listOfHomes.length < 1) {
        player.sendMessage(
            "§cUnexpected error in deleting a home. Contact Speedister for correction."
        );
        console.error(
            `Unexpected error in deleting a home. ${player.name} tried to delete a home with no homes recorded.`
        );
        return false;
    }

    const homesToReturn = listOfHomes.filter((aHome) => {
        return aHome.id !== home.id;
    });

    if (homesToReturn.length !== listOfHomes.length) {
        updateHomeBal(player, "delete");
        player.sendMessage(
            `§aHome ${
                home.name
            } successfully deleted, and a home slot has been made available.\nTotal slots available: ${getHomeBal(
                player
            )}`
        );
        player.setDynamicProperty("hnw:homes", JSON.stringify(homesToReturn));
        return true;
    } else {
        player.sendMessage(
            `§cFailed to delete the home "${home.name}." Could not find the home in list to delete.`
        );
        return false;
    }
}

function delWarp(player: Player, warp: Warp): boolean {
    if (player.id !== warp.owner.id) {
        player.sendMessage(
            "§4Permission denied. That warp was not set by you."
        );
        return false;
    }

    const listOfWarps = getWarpList();
    if (searchWarpList(warp.name, listOfWarps) < 0) {
        player.sendMessage(
            "§cCould not find warp to delete. Either it doesn't exist or was just deleted."
        );
        return false;
    }

    const warpsToReturn = listOfWarps.filter((aWarp) => {
        return aWarp.id !== warp.id;
    });

    if (warpsToReturn.length !== listOfWarps.length) {
        if (!warp.defaultWarp) {
            updateWarpBal(player, "delete");
            player.sendMessage(
                `§aWarp "${
                    warp.name
                }" successfully deleted, and a warp slot has been made available.\nTotal slots available: ${getWarpBal(
                    player
                )}`
            );
        } else {
            player.sendMessage(
                `§Warp "${warp.name}" successfully deleted. No change to personal warp slots, as it was a default warp.`
            );
        }
        world.setDynamicProperty("hnw:warps", JSON.stringify(warpsToReturn));
        return true;
    } else {
        player.sendMessage(
            `§cFailed to delete the warp "${warp.name}." Could not find the warp in list to delete.`
        );
        return false;
    }
}

function getID(): number {
    if (!world.getDynamicProperty("idCounter"))
        world.setDynamicProperty("idCounter", 1);
    const idToReturn = Number(world.getDynamicProperty("idCounter"));
    world.setDynamicProperty("idCounter", idToReturn + 1);
    return idToReturn;
}

function getHomeBal(player: Player): number {
    if (player.getDynamicProperty("hnw:homeBal") === undefined) {
        player.setDynamicProperty("hnw:homeBal", HOME_LIMIT);
    }
    return player.getDynamicProperty("hnw:homeBal") as number;
}

function getHomeList(player: Player): Home[] {
    if (player.getDynamicProperty("hnw:homes")) {
        const listOfHomes: Home[] = JSON.parse(
            player.getDynamicProperty("hnw:homes").toString()
        );
        return listOfHomes;
    } else {
        return [];
    }
}

function getWarpBal(player: Player): number {
    if (player.getDynamicProperty("hnw:warpBal") === undefined) {
        player.setDynamicProperty("hnw:warpBal", WARP_LIMIT);
    }
    return player.getDynamicProperty("hnw:warpBal") as number;
}

function getWarpList(): Warp[] {
    if (world.getDynamicProperty("hnw:warps"))
        return JSON.parse(
            world.getDynamicProperty("hnw:warp").toString()
        ) as Warp[];
    else return [] as Warp[];
}

function goToHome(player: Player, home: Home, safeCheck: boolean): boolean {
    const loc: Vector3 = {
        x: home.locX,
        y: home.locY,
        z: home.locZ,
    };
    const teleOpts: TeleportOptions = new Object();
    const theDim = world.getDimension(home.dimension);
    teleOpts.dimension = theDim;
    teleOpts.checkForBlocks = false;
    teleOpts.keepVelocity = false;
    if (safeCheck) {
        try {
            if (
                theDim.getBlock(loc) &&
                theDim.getBlock(loc).isValid() &&
                theDim.getBlock(loc).isAir &&
                theDim.getBlock(loc).above().isAir &&
                !theDim.getBlock(loc).below().isAir &&
                !theDim.getBlock(loc).below().isLiquid
            ) {
                player.teleport(loc, teleOpts);
            } else {
                teleAlert.show(player).then((o: MessageFormResponse) => {
                    if (o.canceled || o.selection === 1) return;

                    player.teleport(loc, teleOpts);
                    return true;
                });
            }
        } catch ({ name, message }) {
            player.sendMessage(`§cHome teleport failed. Error: ${message}`);
            return false;
        }
    } else {
        player.teleport(loc, teleOpts);
    }
}

function goToWarp(player: Player, warp: Warp, safeCheck: boolean): boolean {
    const loc: Vector3 = {
        x: warp.locX,
        y: warp.locY,
        z: warp.locZ,
    };
    const teleOpts: TeleportOptions = new Object();
    const theDim = world.getDimension(warp.dimension);
    teleOpts.dimension = theDim;
    teleOpts.checkForBlocks = false;
    teleOpts.keepVelocity = false;
    if (safeCheck) {
        try {
            if (
                theDim.getBlock(loc) &&
                theDim.getBlock(loc).isValid() &&
                theDim.getBlock(loc).isAir &&
                theDim.getBlock(loc).above().isAir &&
                !theDim.getBlock(loc).below().isAir &&
                !theDim.getBlock(loc).below().isLiquid
            ) {
                player.teleport(loc, teleOpts);
            } else {
                teleAlert.show(player).then((o: MessageFormResponse) => {
                    if (o.canceled || o.selection === 1) return;

                    player.teleport(loc, teleOpts);
                    return true;
                });
            }
        } catch ({ name, message }) {
            player.sendMessage(`§cWarp teleport failed. Error: ${message}`);
            return false;
        }
    } else {
        player.teleport(loc, teleOpts);
    }
}

function searchHomeList(homeName: string, listOfHomes: Home[]): number {
    for (let i = 0; i < listOfHomes.length; i++) {
        if (listOfHomes[i].name === homeName) return i;
    }
    return -1;
}

function searchWarpList(warpName: string, listOfWarps: Warp[]): number {
    for (let i = 0; i < listOfWarps.length; i++) {
        if (listOfWarps[i].name === warpName) return i;
    }
    return -1;
}

function setHome(
    player: Player,
    playerLoc: Vector3,
    playerDim: string,
    homeName = "Home"
): boolean {
    if (!homeName) homeName = "Home";

    const listOfHomes = getHomeList(player);

    const resultInd = searchHomeList(homeName, listOfHomes);
    if (resultInd >= 0) {
        listOfHomes[resultInd].locX = playerLoc.x;
        listOfHomes[resultInd].locY = playerLoc.y;
        listOfHomes[resultInd].locZ = playerLoc.z;
        listOfHomes[resultInd].dimension = playerDim;
        player.sendMessage(
            `§aHome named "${homeName}" successfully updated. Home balance not affected.`
        );
    } else {
        if (!updateHomeBal(player, "set")) return false;

        const homeToAdd = new Home(
            player.dimension.id,
            homeName,
            playerLoc.x,
            playerLoc.y,
            playerLoc.z
        );

        listOfHomes.push(homeToAdd);
        player.sendMessage(
            `§aNew home named "${
                homeToAdd.name
            }" successfully set.\nRemaining available homes to set: ${getHomeBal(
                player
            )}`
        );
    }

    player.setDynamicProperty("hnw:homes", JSON.stringify(listOfHomes));

    return true;
}

function setWarp(
    player: Player,
    playerLoc: Vector3,
    playerDim: string,
    isDefault: boolean,
    warpName = "Warp"
): boolean {
    if (!warpName) warpName = "Warp";

    const listOfWarps = getWarpList();

    const resultInd = searchWarpList(warpName, listOfWarps);
    if (resultInd >= 0) {
        if (listOfWarps[resultInd].owner.id !== player.id) {
            player.sendMessage(
                "§cName for warp already taken. Please choose another name."
            );
            return false;
        }
        listOfWarps[resultInd].locX = playerLoc.x;
        listOfWarps[resultInd].locY = playerLoc.y;
        listOfWarps[resultInd].locZ = playerLoc.z;
        listOfWarps[resultInd].dimension = playerDim;
        player.sendMessage(
            `§aWarp named "${warpName}" successfully updated. Warp balance not affected.`
        );
    } else {
        if (!isDefault) {
            if (!updateWarpBal(player, "set")) return false;
        }
        const warpToAdd = new Warp(
            player.dimension.id,
            player,
            warpName,
            playerLoc.x,
            playerLoc.y,
            playerLoc.z,
            isDefault
        );

        listOfWarps.push(warpToAdd);
        player.sendMessage(
            `§aNew warp named "${warpToAdd.name}" successfully set.`
        );

        if (!isDefault) {
            player.sendMessage(
                `§aRemaining warp balance: ${getWarpBal(player)}`
            );
        }

        return true;
    }

    player.setDynamicProperty("hnw:warps", JSON.stringify(listOfWarps));

    return true;
}

function showMainMenu(player, listOfHomes: Home[])
{
    
        mainMenu.show(player).then((s: ActionFormResponse) => {
            if (s.canceled) return;

            switch (s.selection) {
                case 0:
                    if (listOfHomes.length < 1) {
                        const emptyMenu = new MessageFormData()
                            .title("No Homes Set")
                            .body(
                                "No homes are recorded for this player. Set a new home here?"
                            )
                            .button1("§aYes - Set here")
                            .button2("§cNo - Cancel");
                        emptyMenu
                            .show(player)
                            .then((n: MessageFormResponse) => {
                                if (n.canceled || n.selection === 1) return;

                                namingHMenu
                                    .show(player)
                                    .then((nameR: ModalFormResponse) => {
                                        if (nameR.canceled) return;

                                        const [homeName] = nameR.formValues;

                                        setHome(
                                            player,
                                            player.location,
                                            homeName.toString()
                                        );
                                    });
                            });
                    } else {
                        homeMenu = new ActionFormData().title("Your Homes");
                        for (const home of listOfHomes) {
                            homeMenu.button(home.name);
                        }
                        homeMenu
                            .show(player)
                            .then((h: ActionFormResponse) => {
                                if (h.canceled) return;

                                const selectedHome =
                                    listOfHomes[h.selection];

                                const manageHome = new ActionFormData()
                                    .title(`Managing ${selectedHome.name}`)
                                    .body(
                                        `Located at x:${selectedHome.locX}, y: ${selectedHome.locY}, z: ${selectedHome.locZ}` +
                                            `\nDimension: ${selectedHome.dimension.substring(
                                                10
                                            )}`
                                    )
                                    .button("Teleport here")
                                    .button(
                                        "Teleport here with safety check"
                                    )
                                    .button("Delete")
                                    .button("Exit");

                                manageHome
                                    .show(player)
                                    .then((a: ActionFormResponse) => {
                                        if (a.canceled) return;

                                        switch (a.selection) {
                                            case 0:
                                                goToHome(
                                                    player,
                                                    selectedHome,
                                                    false
                                                );
                                                break;
                                            case 1:
                                                goToHome(
                                                    player,
                                                    selectedHome,
                                                    true
                                                );
                                                break;
                                            case 2:
                                                delHome(
                                                    player,
                                                    selectedHome
                                                );
                                                break;
                                            case 3:
                                                return;
                                            default:
                                        }
                                    });
                            });
                    }
                    break;
                case 1:
                    break;
                default:
            }
        });

        return;
    
}

function updateHomeBal(player: Player, mode: "set" | "delete"): boolean {
    let homeBal = getHomeBal(player);
    if (mode === "set") {
        if (homeBal < 1) {
            player.sendMessage(
                `§cHome limit (${HOME_LIMIT}) reached, setting of home cancelled.`
            );
            return false;
        }

        homeBal--;
        return true;
    } else if (homeBal >= 0 && homeBal < HOME_LIMIT) {
        homeBal++;
        return true;
    } else {
        player.sendMessage(
            "§cUnexpected error in updating home balance. Contact Speedister for correction."
        );
        return false;
    }
}

function updateWarpBal(player: Player, mode: "set" | "delete"): boolean {
    let warpBal = getWarpBal(player);
    if (mode === "set") {
        if (warpBal < 1) {
            player.sendMessage(
                `§cWarp limit (${WARP_LIMIT}) reached, setting of warp cancelled.`
            );
            return false;
        }

        warpBal--;
        return true;
    } else if (warpBal >= 0 && warpBal < WARP_LIMIT) {
        warpBal++;
        return true;
    } else {
        player.sendMessage(
            "§cUnexpected error in updating warp balance. Contact Speedister for correction."
        );
        return false;
    }
}

const teleAlert = new MessageFormData()
    .title("§e§lCAUTION: §r§eHome Safety Uncertain")
    .body(
        "§e§iWarning!\n\nHome safety check failed.\n\nThe set home could be currently either: unloaded," +
            " obstructed, missing a grounding block, or containing water/lava. Override and continue?"
    )
    .button1("§aProceed")
    .button2("§4Cancel");

let homeMenu = new ActionFormData().title("Your Homes");

const namingHMenu = new ModalFormData()
    .title("New Home Name")
    .textField("Home name", "(Optional) Ex: Base")
    .submitButton("§aSet Home");

const mainMenu = new ActionFormData()
    .title("Home N Warp")
    .button("My Homes", "textures/blocks/stonebrick")
    .button("World Warps");

world.beforeEvents.itemUse.subscribe((event) => {
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
        const listOfHomes = getHomeList(player);

        system.run(() => {
            showMainMenu(player, listOfHomes);
        });
    }
});
