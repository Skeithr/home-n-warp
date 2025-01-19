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
        this.owner = defWarp
            ? new StorablePlayer("-123", "World")
            : new StorablePlayer(owner.id, owner.name);
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
    if (searchWarpListInd(warp.name, listOfWarps) < 0) {
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

function goToHome(player, home: Home, safeCheck: boolean): boolean {
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

function goToWarp(player, warp: Warp, safeCheck: boolean): boolean {
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

function homeErrorMsg(player: Player, homeName: string) {
    player.sendMessage(
        `§cHome "${homeName}" not found. Please check spelling.`
    );
}

function searchHomeList(homeName: string, listOfHomes: Home[]): Home | null {
    for (const home of listOfHomes) {
        if (home.name === homeName) return home;
    }
    return null;
}

function searchHomeListInd(homeName: string, listOfHomes: Home[]): number {
    for (let i = 0; i < listOfHomes.length; i++) {
        if (listOfHomes[i].name === homeName) return i;
    }
    return -1;
}

function searchWarpList(warpName: string, listOfWarps: Warp[]): Warp | null {
    for (const warp of listOfWarps) {
        if (warp.name === warpName) return warp;
    }
    return null;
}

function searchWarpListInd(warpName: string, listOfWarps: Warp[]): number {
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

    const resultInd = searchHomeListInd(homeName, listOfHomes);
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

    const resultInd = searchWarpListInd(warpName, listOfWarps);
    if (resultInd >= 0) {
        if (listOfWarps[resultInd].defaultWarp) {
            if (player.name !== "Speedister") {
                player.sendMessage(
                    "§cName for warp already taken. Please choose another name."
                );
                return false;
            }
        } else if (listOfWarps[resultInd].owner.id !== player.id) {
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
            playerDim,
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

function showdelConfirm(
    player,
    selectedHome: Home | null,
    selectedWarp: Warp | null
) {
    const helperTxt = selectedHome ? "home" : "warp";
    const helperName = selectedHome ? selectedHome.name : selectedWarp.name;
    const deletionConfirm = new MessageFormData()
        .title(`Delete the ${helperTxt} "${helperName}"?`)
        .body("This action cannot be undone.")
        .button1("§cCancel")
        .button2("§cConfirm");

    deletionConfirm.show(player).then((c: MessageFormResponse) => {
        if (c.canceled || c.selection === 0) return;

        selectedHome
            ? delHome(player, selectedHome)
            : delWarp(player, selectedWarp);
    });
}

function showMainMenu(player, listOfHomes: Home[]) {
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
                    emptyMenu.show(player).then((n: MessageFormResponse) => {
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
                    homeMenu.show(player).then((h: ActionFormResponse) => {
                        if (h.canceled) return;

                        const selectedHome = listOfHomes[h.selection];

                        showManaging(player, selectedHome, null);
                    });
                }
                break;
            case 1:
                showWarps(player);
                break;
            default:
        }
    });

    return;
}

function showManaging(
    player,
    selectedHome: Home | null,
    selectedWarp: Warp | null
) {
    const itemName = selectedHome ? selectedHome.name : selectedWarp.name;
    const itemX = selectedHome ? selectedHome.locX : selectedWarp.locX;
    const itemY = selectedHome ? selectedHome.locY : selectedWarp.locY;
    const itemZ = selectedHome ? selectedHome.locZ : selectedWarp.locZ;
    const itemDim = selectedHome
        ? selectedHome.dimension.substring(10)
        : selectedWarp.dimension.substring(10);

    const manageItem = new ActionFormData()
        .title(`Managing ${itemName}`)
        .body(
            `Located at x:${itemX}, y: ${itemY}, z: ${itemZ}` +
                `\nDimension: ${itemDim}`
        )
        .button("Teleport here")
        .button("Teleport here with safety check");
    if (selectedWarp && selectedWarp.owner.id === player.id)
        manageItem.button("Delete");
    manageItem.show(player).then((a: ActionFormResponse) => {
        if (a.canceled) return;

        switch (a.selection) {
            case 0:
                selectedHome
                    ? goToHome(player, selectedHome, false)
                    : goToWarp(player, selectedWarp, false);
                break;
            case 1:
                selectedHome
                    ? goToHome(player, selectedHome, true)
                    : goToWarp(player, selectedWarp, true);
                break;
            default:
                showdelConfirm(player, selectedHome, selectedWarp);
        }
    });
}

function showWarps(player) {
    const listOfWarps = getWarpList();

    if (listOfWarps.length === 0) {
        player.sendMessage("§eNo warps have been set yet.");
        return;
    }
    const displayWarps = new ActionFormData().title("List of All Warps");

    for (const warp of listOfWarps) {
        displayWarps.button(`${warp.name} - ${warp.dimension.substring(10)}`);
    }

    displayWarps.show(player).then((w: ActionFormResponse) => {
        if (w.canceled) return;

        const selectedWarp = listOfWarps[w.selection];

        showManaging(player, null, selectedWarp);
    });
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

function warpErrorMsg(player: Player, warpName: string) {
    player.sendMessage(
        `§cWarp "${warpName}" not found. Please check spelling.`
    );
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

world.beforeEvents.chatSend.subscribe(({ cancel, message, sender }) => {
    if (message.startsWith(">")) {
        cancel = true;
        message.replaceAll(/\s+(?=([^"]*"[^"]*")*[^"]*$)/g, "(|)");
        message.replaceAll('"', "");
        const tokenizedCmd = message.split("(|)");
        const nameOfItem = tokenizedCmd.length > 1 ? tokenizedCmd[1] : "";
        const listOfHomes = getHomeList(sender);
        const listOfWarps = getWarpList();
        switch (tokenizedCmd[0]) {
            case ">listhomes": {
                const listOfHomesLen = listOfHomes.length;
                if (listOfHomesLen < 1) {
                    sender.sendMessage("§eNo homes set for this player.");
                    return;
                }
                let strToPrint = "§6List of your homes: ";
                for (let i = 0; i < listOfHomesLen; i++) {
                    if (i !== listOfHomesLen) {
                        strToPrint = strToPrint + listOfHomes[i].name + ", ";
                    } else {
                        strToPrint = strToPrint + listOfHomes[i].name;
                    }
                }
                sender.sendMessage(strToPrint);
                break;
            }
            case ">listwarps": {
                const listOfWarpsLen = listOfWarps.length;
                if (listOfWarpsLen < 1) {
                    sender.sendMessage("§eNo warps are currently set.");
                    return;
                }
                let strToPrint = "§6List of all warps: ";
                for (let i = 0; i < listOfWarpsLen; i++) {
                    if (i !== listOfWarpsLen) {
                        strToPrint = strToPrint + listOfWarps[i].name + ", ";
                    } else {
                        strToPrint = strToPrint + listOfWarps[i].name;
                    }
                }
                sender.sendMessage(strToPrint);
                break;
            }
            case ">sethome":
                setHome(
                    sender,
                    sender.location,
                    sender.dimension.id,
                    nameOfItem
                );
                break;
            case ">setwarp":
                setWarp(
                    sender,
                    sender.location,
                    sender.dimension.id,
                    false,
                    nameOfItem
                );
                break;
            case ">setwarpdef":
                if (sender.name !== "Speedister") {
                    sender.sendMessage("§4Permission denied.");
                    return;
                }

                if (tokenizedCmd.length < 2) {
                    sender.sendMessage(
                        `§cIncorrect command usage. Please use ">setwarpdef (name)"`
                    );
                    return;
                }

                setWarp(
                    sender,
                    sender.location,
                    sender.dimension.id,
                    true,
                    nameOfItem
                );
                break;
            case ">home": {
                const selectedHome = searchHomeList(nameOfItem, listOfHomes);
                if (!selectedHome) {
                    homeErrorMsg(sender, nameOfItem);
                    return;
                }
                goToHome(sender, selectedHome, false);
                break;
            }
            case ">homesafe": {
                const selectedHome = searchHomeList(nameOfItem, listOfHomes);
                if (!selectedHome) {
                    homeErrorMsg(sender, nameOfItem);
                    return;
                }
                goToHome(sender, selectedHome, true);
                break;
            }
            case ">warp": {
                const selectedWarp = searchWarpList(nameOfItem, listOfWarps);
                if (!selectedWarp) {
                    warpErrorMsg(sender, nameOfItem);
                    return;
                }
                goToWarp(sender, selectedWarp, false);
                break;
            }
            case ">warpsafe": {
                const selectedWarp = searchWarpList(nameOfItem, listOfWarps);
                if (!selectedWarp) {
                    warpErrorMsg(sender, nameOfItem);
                    return;
                }
                goToWarp(sender, selectedWarp, true);
                break;
            }
            case ">delhome": {
                const selectedHome = searchHomeList(nameOfItem, listOfHomes);
                if (!selectedHome) {
                    homeErrorMsg(sender, nameOfItem);
                    return;
                }
                delHome(sender, selectedHome);
                break;
            }
            case ">delwarp": {
                const selectedWarp = searchWarpList(nameOfItem, listOfWarps);
                if (!selectedWarp) {
                    warpErrorMsg(sender, nameOfItem);
                    return;
                }
                delWarp(sender, selectedWarp);
                break;
            }
            default:
                sender.sendMessage(
                    `"Unknown command. Type ">help" (without the quotations) for more info.`
                );
        }
    }
});
