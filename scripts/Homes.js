import { world, system, } from "@minecraft/server";
import { ActionFormData, MessageFormData, ModalFormData, } from "@minecraft/server-ui";
//
//
//
// Add in named claims
//
//
//
//
// Add in brewable xp potions
//
//
//
//
//
// Test this and the claims plugin together
//
//
//
//
//
// Be able to set server claims? At very least, update your spawn claim
//
//
//
const HOME_LIMIT = 3;
const WARP_LIMIT = 1;
//
//
//
// Update command dictionary
//
//
//
const CMD_DICTIONARY = {
    delhome: [" (home name)", "Deletes a home you have set."],
    delwarp: [" (warp name)", "Deletes a warp you have set."],
    help: [
        " [command name]",
        "Displays info about commands.\nIf a command name is provided, only that command will be displayed.",
    ],
    home: [
        " [home name]",
        "Teleport to a location you have stored." +
            `\nIf no name is provided, the default name "Home" will be used.`,
    ],
    homebal: ["", "Displays how many homes are left that you can set."],
    listhomes: ["", "Lists all the homes currently set by you."],
    listwarps: ["", "List all warps for anyone to teleport to."],
    sethome: [
        " [home name]",
        "Set a home location, or if already set by you, reset the home location to a new one." +
            `\nIf no name is provided, the default name "Home" will be used.`,
    ],
    setwarp: [
        " [warp name]",
        "Set a warp location for anyone in the server to use. If already set by you, the location is updated." +
            `\nIf no name is provided, the default name "Warp" will be used, if available.`,
    ],
    warp: [
        " [warp name]",
        "Teleport to a location that is available to everyone." +
            `\nIf no name is provided, the default name "Warp" will be used.`,
    ],
    warpbal: ["", "Displays how many warps are left that you can set."],
};
class Home {
    constructor(dim, hName, loc) {
        this.id = getID();
        this.name = hName;
        this.dimension = dim;
        this.location = loc;
    }
}
class Location {
    constructor(coords, dim) {
        this.coordinates = coords;
        this.dimension = dim;
    }
}
class SafetyCheck {
    constructor() {
        this.loaded = false;
        this.valid = false;
        this.air = false;
        this.sturdyFloor = false;
    }
}
class StorablePlayer {
    constructor(anId, aName) {
        this.id = anId;
        this.name = aName;
    }
}
class Warp {
    constructor(dim, owner, wName, loc, defWarp) {
        this.id = getID();
        this.name = wName;
        this.owner = defWarp
            ? new StorablePlayer("-123", "World")
            : new StorablePlayer(owner.id, owner.name);
        this.dimension = dim;
        this.location = loc;
        this.defaultWarp = defWarp;
    }
}
function back(player) {
    if (player.getDynamicProperty("hnw:back")) {
        const { coordinates, dimension } = JSON.parse(player.getDynamicProperty("hnw:back").toString());
        playerTele(player, coordinates, {
            dimension: world.getDimension(dimension),
            keepVelocity: false,
            checkForBlocks: false,
        });
    }
    else
        player.sendMessage("§eNo location stored to warp back to.");
}
/*
    Eventually added check for hostile mobs?
*/
function checkSafety(loc, dim) {
    const theBlock = world.getDimension(dim).getBlock(loc);
    const checkToReturn = new SafetyCheck();
    if (!theBlock || !theBlock.above() || !theBlock.below())
        return checkToReturn;
    else
        checkToReturn.loaded = true;
    if (!theBlock.isValid() ||
        !theBlock.above().isValid() ||
        !theBlock.below().isValid())
        return checkToReturn;
    else
        checkToReturn.valid = true;
    if (theBlock.isAir && theBlock.above().isAir)
        checkToReturn.air = true;
    if (!theBlock.below().isAir && !theBlock.below().isLiquid)
        checkToReturn.sturdyFloor = true;
    return checkToReturn;
}
function delHome(player, home) {
    const listOfHomes = getHomeList(player);
    if (listOfHomes.length < 1) {
        player.sendMessage("§cUnexpected error in deleting a home. Contact Speedister for correction.");
        console.error(`Unexpected error in deleting a home. ${player.name} tried to delete a home with no homes recorded.`);
        return false;
    }
    const homesToReturn = listOfHomes.filter((aHome) => {
        return aHome.id !== home.id;
    });
    if (homesToReturn.length !== listOfHomes.length) {
        updateHomeBal(player, "delete");
        player.sendMessage(`§aHome ${home.name} successfully deleted, and a home slot has been made available.\nTotal slots available: ${getHomeBal(player)}`);
        player.setDynamicProperty("hnw:homes", JSON.stringify(homesToReturn));
        return true;
    }
    else {
        player.sendMessage(`§cFailed to delete the home "${home.name}." Could not find the home in list to delete.`);
        return false;
    }
}
function delWarp(player, warp) {
    //
    //
    // Add in back door for you for the default warps and any
    // problematic warps that need deleting.
    //
    //
    if (player.id !== warp.owner.id) {
        player.sendMessage("§4Permission denied. That warp was not set by you.");
        return false;
    }
    const listOfWarps = getWarpList();
    if (searchWarpListInd(warp.name, listOfWarps) < 0) {
        player.sendMessage("§cCould not find warp to delete. Either it doesn't exist or was just deleted.");
        return false;
    }
    const warpsToReturn = listOfWarps.filter((aWarp) => {
        return aWarp.id !== warp.id;
    });
    if (warpsToReturn.length !== listOfWarps.length) {
        if (!warp.defaultWarp) {
            updateWarpBal(player, "delete");
            player.sendMessage(`§aWarp "${warp.name}" successfully deleted, and a warp slot has been made available.\nTotal slots available: ${getWarpBal(player)}`);
        }
        else {
            player.sendMessage(`§Warp "${warp.name}" successfully deleted. No change to personal warp slots, as it was a default warp.`);
        }
        world.setDynamicProperty("hnw:warps", JSON.stringify(warpsToReturn));
        return true;
    }
    else {
        player.sendMessage(`§cFailed to delete the warp "${warp.name}." Could not find the warp in list to delete.`);
        return false;
    }
}
function displayChecks(loaded, valid, air, sturdy) {
    const yes = "§aYes";
    const no = "§cNo";
    const undetermined = "§eUndetermined";
    let loadedCheck = "\n§r§dLoaded? ";
    let validCheck = "\n§r§dValid in memory? ";
    let airCheck = "\n§r§dBreathable? ";
    let sturdyCheck = "\n§r§dSturdy to stand on? ";
    let loadedRes = "";
    let validRes = "";
    let airRes = "";
    let sturdyRes = "";
    if (!loaded) {
        loadedRes = no;
        validRes = no;
        airRes = undetermined;
        sturdyRes = undetermined;
    }
    else if (!valid) {
        loadedRes = yes;
        validRes = no;
        airRes = undetermined;
        sturdyRes = undetermined;
    }
    else {
        loadedRes = yes;
        validRes = yes;
        airRes = air ? yes : no;
        sturdyRes = sturdy ? yes : no;
    }
    loadedCheck += loadedRes;
    validCheck += validRes;
    airCheck += airRes;
    sturdyCheck += sturdyRes;
    return loadedCheck + validCheck + airCheck + sturdyCheck;
}
function getID() {
    if (!world.getDynamicProperty("idCounter"))
        world.setDynamicProperty("idCounter", 1);
    const idToReturn = Number(world.getDynamicProperty("idCounter"));
    world.setDynamicProperty("idCounter", idToReturn + 1);
    return idToReturn;
}
function getHomeBal(player) {
    if (player.getDynamicProperty("hnw:homeBal") === undefined) {
        player.setDynamicProperty("hnw:homeBal", HOME_LIMIT);
    }
    return player.getDynamicProperty("hnw:homeBal");
}
function getHomeList(player) {
    if (player.getDynamicProperty("hnw:homes")) {
        const listOfHomes = JSON.parse(player.getDynamicProperty("hnw:homes").toString());
        return listOfHomes;
    }
    else {
        return [];
    }
}
function getWarpBal(player) {
    if (player.getDynamicProperty("hnw:warpBal") === undefined) {
        player.setDynamicProperty("hnw:warpBal", WARP_LIMIT);
    }
    return player.getDynamicProperty("hnw:warpBal");
}
function getWarpList() {
    if (world.getDynamicProperty("hnw:warps"))
        return JSON.parse(world.getDynamicProperty("hnw:warps").toString());
    else
        return [];
}
function goToHome(player, { dimension, location }) {
    try {
        const teleOpts = new Object();
        const theDim = world.getDimension(dimension);
        teleOpts.dimension = theDim;
        teleOpts.checkForBlocks = false;
        teleOpts.keepVelocity = false;
        playerTele(player, location, teleOpts);
    }
    catch (error) {
        console.error(error);
        return false;
    }
}
function goToWarp(player, { dimension, location }) {
    const teleOpts = new Object();
    try {
        const theDim = world.getDimension(dimension);
        teleOpts.dimension = theDim;
        teleOpts.checkForBlocks = false;
        teleOpts.keepVelocity = false;
        playerTele(player, location, teleOpts);
        return true;
    }
    catch (error) {
        console.error(error);
        return false;
    }
}
function homeErrorMsg(player, homeName) {
    player.sendMessage(`§cHome "${homeName}§r§c" is not found or has not been set yet.`);
}
function playerTele(player, locDest, teleOpts) {
    const playerLoc = player.location;
    const playerDim = player.dimension;
    const locToStore = new Location(playerLoc, playerDim.id);
    player.setDynamicProperty("hnw:back", JSON.stringify(locToStore));
    system.run(() => player.teleport(locDest, teleOpts));
}
function renameHome(player, homeToRename, newName) {
    if (newName.length > 25) {
        player.sendMessage("§cHome name is too long. Max 25 characters");
        return false;
    }
    if (newName.includes(`"`)) {
        player.sendMessage("§cHome name must not contain quotation marks. Please adjust name accordingly.");
        return false;
    }
    const listOfHomes = getHomeList(player);
    const resultInd = searchHomeListInd(homeToRename.name, listOfHomes);
    if (resultInd < 0) {
        player.sendMessage(`§cHome "${homeToRename.name}§r§c" could not be renamed: could not be found.`);
        return false;
    }
    else {
        player.sendMessage(`§aHome named "${homeToRename.name}§r§a" has been renamed to "${newName}§r§a".`);
        listOfHomes[resultInd].name = newName;
        player.setDynamicProperty("hnw:homes", JSON.stringify(listOfHomes));
        return true;
    }
}
function renameWarp(player, warpToRename, newName) {
    if (newName.length > 25) {
        player.sendMessage("§cWarp name is too long. Max 25 characters");
        return false;
    }
    if (newName.includes(`"`)) {
        player.sendMessage("§cWarp name must not contain quotation marks. Please adjust name accordingly.");
        return false;
    }
    const listOfWarps = getWarpList();
    const resultInd = searchWarpListInd(warpToRename.name, listOfWarps);
    if (resultInd < 0) {
        player.sendMessage(`§cWarp "${warpToRename.name}§r§c" could not be renamed: could not be found.`);
        return false;
    }
    else if ((listOfWarps[resultInd].defaultWarp && player.name === "Speedister") ||
        listOfWarps[resultInd].owner.id === player.id) {
        player.sendMessage(`§aWarp named "${warpToRename.name}§r§a" has been renamed to "${newName}§r§a".`);
        listOfWarps[resultInd].name = newName;
        player.setDynamicProperty("hnw:warps", JSON.stringify(listOfWarps));
        return true;
    }
    else {
        player.sendMessage(`§cWarp "${warpToRename.name}§r§c" does not belong to you, renaming cancelled.`);
        return false;
    }
}
function searchHomeList(homeName, listOfHomes) {
    for (const home of listOfHomes) {
        if (home.name.toLowerCase() === homeName.toLowerCase())
            return home;
    }
    return null;
}
function searchHomeListInd(homeName, listOfHomes) {
    for (let i = 0; i < listOfHomes.length; i++) {
        if (listOfHomes[i].name.toLowerCase() === homeName.toLowerCase())
            return i;
    }
    return -1;
}
function searchWarpList(warpName, listOfWarps) {
    for (const warp of listOfWarps) {
        if (warp.name.toLowerCase() === warpName.toLowerCase())
            return warp;
    }
    return null;
}
function searchWarpListInd(warpName, listOfWarps) {
    for (let i = 0; i < listOfWarps.length; i++) {
        if (listOfWarps[i].name.toLowerCase() === warpName.toLowerCase())
            return i;
    }
    return -1;
}
function selectDimension(dimName) {
    switch (dimName) {
        case "minecraft:overworld":
            return "§aOverworld";
        case "minecraft:nether":
            return "§4Nether";
        case "minecraft:the_end":
            return "§dThe End";
        default:
            return "Unknown dimension";
    }
}
function setHome(player, playerLoc, playerDim, homeName = "Home") {
    if (!homeName)
        homeName = "Home";
    if (homeName.length > 25) {
        player.sendMessage("§cWarp name is too long. Max 25 characters");
        return false;
    }
    if (homeName.includes(`"`)) {
        player.sendMessage("§cHome name must not contain quotation marks. Please adjust name accordingly.");
        return false;
    }
    const listOfHomes = getHomeList(player);
    const resultInd = searchHomeListInd(homeName, listOfHomes);
    if (resultInd >= 0) {
        listOfHomes[resultInd].location = playerLoc;
        listOfHomes[resultInd].dimension = playerDim;
        player.sendMessage(`§aHome named "${homeName}§r§a" successfully updated. Home balance not affected.`);
    }
    else {
        if (!updateHomeBal(player, "set"))
            return false;
        const homeToAdd = new Home(player.dimension.id, homeName, playerLoc);
        listOfHomes.push(homeToAdd);
        player.sendMessage(`§aNew home named "${homeToAdd.name}§r§a" successfully set.\nRemaining available homes to set: ${getHomeBal(player)}`);
    }
    player.setDynamicProperty("hnw:homes", JSON.stringify(listOfHomes));
    return true;
}
function setWarp(player, playerLoc, playerDim, isDefault, warpName = "Warp") {
    if (!warpName)
        warpName = "Warp";
    if (warpName.includes(`"`)) {
        player.sendMessage("§cWarp name must not contain quotation marks. Please adjust name accordingly.");
        return false;
    }
    if (warpName.length > 25) {
        player.sendMessage("§cWarp name is too long. Max 25 characters");
        return false;
    }
    const listOfWarps = getWarpList();
    const resultInd = searchWarpListInd(warpName, listOfWarps);
    if (resultInd >= 0) {
        if (listOfWarps[resultInd].defaultWarp) {
            if (player.name !== "Speedister") {
                player.sendMessage("§cName for warp already taken. Please choose another name.");
                return false;
            }
        }
        else if (listOfWarps[resultInd].owner.id !== player.id) {
            player.sendMessage("§cName for warp already taken. Please choose another name.");
            return false;
        }
        listOfWarps[resultInd].location = playerLoc;
        listOfWarps[resultInd].dimension = playerDim;
        player.sendMessage(`§aWarp named "${warpName}§r§a" successfully updated. Warp balance not affected.`);
    }
    else {
        if (!isDefault) {
            if (!updateWarpBal(player, "set"))
                return false;
        }
        const warpToAdd = new Warp(playerDim, player, warpName, playerLoc, isDefault);
        listOfWarps.push(warpToAdd);
        player.sendMessage(`§aNew warp named "${warpToAdd.name}§r§a" successfully set.`);
        if (!isDefault) {
            player.sendMessage(`§aRemaining warp balance: ${getWarpBal(player)}`);
        }
    }
    world.setDynamicProperty("hnw:warps", JSON.stringify(listOfWarps));
    return true;
}
function showdelConfirm(player, selectedHome, selectedWarp) {
    const helperTxt = selectedHome ? "home" : "warp";
    const helperName = selectedHome ? selectedHome.name : selectedWarp.name;
    const deletionConfirm = new MessageFormData()
        .title(`Delete the ${helperTxt} "${helperName}"?`)
        .body("This action cannot be undone.")
        .button1("§cCancel")
        .button2("§aConfirm");
    deletionConfirm.show(player).then((c) => {
        if (c.canceled || c.selection === 0)
            return;
        selectedHome
            ? delHome(player, selectedHome)
            : delWarp(player, selectedWarp);
    });
}
function showHomes(player) {
    const listOfHomes = getHomeList(player);
    const amtOfHomes = listOfHomes.length;
    const homeMenu = new ActionFormData().title("§5Your Homes");
    for (const home of listOfHomes) {
        homeMenu.button(`${home.name} §r- ${selectDimension(home.dimension)}`);
    }
    if (amtOfHomes < HOME_LIMIT)
        homeMenu.button("§2--Add a home--");
    homeMenu.show(player).then((h) => {
        if (h.canceled)
            return;
        if (h.selection === amtOfHomes && amtOfHomes < HOME_LIMIT) {
            showNamingForm(player, "home");
        }
        else {
            const selectedHome = listOfHomes[h.selection];
            showManaging(player, selectedHome, null);
        }
    });
}
function showMainMenu(player) {
    mainMenu.show(player).then((s) => {
        if (s.canceled)
            return;
        switch (s.selection) {
            case 0:
                showHomes(player);
                break;
            case 1:
                showWarps(player);
                break;
            case 2:
                back(player);
                break;
            default:
        }
    });
    return;
}
function showManaging(player, selectedHome, selectedWarp) {
    const locName = selectedHome ? selectedHome.name : selectedWarp.name;
    const loc = selectedHome ? selectedHome.location : selectedWarp.location;
    const locX = loc.x;
    const locY = loc.y;
    const locZ = loc.z;
    const locDim = selectedHome
        ? selectedHome.dimension
        : selectedWarp.dimension;
    const { air, loaded, sturdyFloor, valid } = checkSafety(loc, locDim);
    const strOfChecks = displayChecks(loaded, valid, air, sturdyFloor);
    const manageLoc = new ActionFormData()
        .title(`Viewing '${locName}§r'`)
        .body(`Located at §sx: ${locX.toFixed(0)}, y: ${locY.toFixed(0)}, z: ${locZ.toFixed(0)}` +
        `§r\nDimension: ${selectDimension(locDim)}` +
        `\n\n§rIs the location:${strOfChecks}`)
        .button("Teleport here");
    if (selectedHome || (selectedWarp && selectedWarp.owner.id === player.id)) {
        manageLoc.button("Rename");
        manageLoc.button("Reset location to here");
        manageLoc.button("Delete");
    }
    manageLoc.show(player).then((a) => {
        if (a.canceled)
            return;
        switch (a.selection) {
            case 0:
                selectedHome
                    ? goToHome(player, selectedHome)
                    : goToWarp(player, selectedWarp);
                break;
            case 1:
                selectedHome
                    ? showRenamingForm(player, selectedHome, null)
                    : showRenamingForm(player, null, selectedWarp);
                break;
            case 2:
                selectedHome
                    ? setHome(player, player.location, player.dimension.id, selectedHome.name)
                    : setWarp(player, player.location, player.dimension.id, false, selectedWarp.name);
                break;
            case 3:
                showdelConfirm(player, selectedHome, selectedWarp);
                break;
            default:
                player.sendMessage("§eUnknown managing command. Contact Speedister for correction.");
        }
    });
}
/*
    Color options for naming the home? Drop down?
*/
function showNamingForm(player, typeOfLoc) {
    if (typeOfLoc === "home") {
        namingHMenu.show(player).then((nameR) => {
            if (nameR.canceled)
                return;
            const homeName = nameR.formValues[0];
            if (!setHome(player, player.location, player.dimension.id, homeName))
                showNamingForm(player, "home");
        });
    }
    else {
        namingWMenu.show(player).then((nameR) => {
            if (nameR.canceled)
                return;
            const warpName = nameR.formValues[0];
            if (!setWarp(player, player.location, player.dimension.id, false, warpName))
                showNamingForm(player, "warp");
        });
    }
}
function showRenamingForm(player, homeToRename, warpToRename) {
    if (homeToRename) {
        const renamingHMenu = new ModalFormData()
            .title(`Renaming ${homeToRename.name}`)
            .textField("Home name (can't contain quotation marks)", "(Optional) Ex: Base")
            .submitButton("§aRename Home");
        renamingHMenu.show(player).then((renameF) => {
            if (renameF.canceled)
                return;
            const newHomeName = renameF.formValues[0];
            if (!renameHome(player, homeToRename, newHomeName))
                showRenamingForm(player, homeToRename, null);
        });
    }
    else {
        const renamingWMenu = new ModalFormData()
            .title(`Renaming ${warpToRename.name}`)
            .textField("Warp name (can't contain quotation marks)", "(Optional) Ex: Woodland Mansion")
            .submitButton("§aRename Warp");
        renamingWMenu.show(player).then((renameF) => {
            if (renameF.canceled)
                return;
            const newWarpName = renameF.formValues[0];
            if (!renameWarp(player, warpToRename, newWarpName))
                showRenamingForm(player, null, warpToRename);
        });
    }
}
function showWarps(player) {
    const listOfWarps = getWarpList();
    const playerWarpBal = getWarpBal(player);
    if (listOfWarps.length === 0) {
        player.sendMessage("§eNo warps have been set yet.");
        return;
    }
    const displayWarps = new ActionFormData().title("§5List of All Warps");
    if (playerWarpBal > 0)
        displayWarps.button("§2--Add a Warp--");
    for (const warp of listOfWarps) {
        displayWarps.button(`${warp.name} - ${selectDimension(warp.dimension)}`);
    }
    displayWarps.show(player).then((w) => {
        if (w.canceled)
            return;
        let selectedWarp;
        if (playerWarpBal > 0) {
            if (w.selection === 0) {
                showNamingForm(player, "warp");
                return;
            }
            else {
                selectedWarp = listOfWarps[w.selection - 1];
            }
        }
        else
            selectedWarp = listOfWarps[w.selection];
        showManaging(player, null, selectedWarp);
    });
}
function updateHomeBal(player, mode) {
    let homeBal = getHomeBal(player);
    if (mode === "set") {
        if (homeBal < 1) {
            player.sendMessage(`§cHome limit (${HOME_LIMIT}) reached, setting of home cancelled.`);
            return false;
        }
        homeBal--;
        player.setDynamicProperty("hnw:homeBal", homeBal);
        return true;
    }
    else if (homeBal >= 0 && homeBal < HOME_LIMIT) {
        homeBal++;
        player.setDynamicProperty("hnw:homeBal", homeBal);
        return true;
    }
    else {
        player.sendMessage("§cUnexpected error in updating home balance. Contact Speedister for correction.");
        return false;
    }
}
function updateWarpBal(player, mode) {
    let warpBal = getWarpBal(player);
    if (mode === "set") {
        if (warpBal < 1) {
            player.sendMessage(`§cWarp limit (${WARP_LIMIT}) reached, setting of warp cancelled.`);
            return false;
        }
        warpBal--;
        player.setDynamicProperty("hnw:warpBal", warpBal);
        return true;
    }
    else if (warpBal >= 0 && warpBal < WARP_LIMIT) {
        warpBal++;
        player.setDynamicProperty("hnw:warpBal", warpBal);
        return true;
    }
    else {
        player.sendMessage("§cUnexpected error in updating warp balance. Contact Speedister for correction.");
        return false;
    }
}
function warpErrorMsg(player, warpName) {
    player.sendMessage(`§cWarp "${warpName}§r§c" is not found or has not been set yet.`);
}
const teleAlert = new MessageFormData()
    .title("§e§lCAUTION: §r§eHome Safety Uncertain")
    .body("§e§iWarning!\n\nHome safety check failed.\n\nThe set home could be currently either: unloaded," +
    " obstructed, missing a grounding block, or containing water/lava. Override and continue?")
    .button1("§aProceed")
    .button2("§4Cancel");
const namingHMenu = new ModalFormData()
    .title("New Home Name")
    .textField("Home name", "(Optional) Ex: Base")
    .submitButton("§aSet Home");
const namingWMenu = new ModalFormData()
    .title("New Warp Name")
    .textField("Warp name", "(Optional) Ex: Woodland Mansion")
    .submitButton("§aSet Warp");
//
//
//
//
//
// Add color to the main menu
//
//
//
//
const mainMenu = new ActionFormData()
    .title("§5Home N Warp")
    .button("My Homes", "textures/blocks/stonebrick")
    .button("World Warps", "textures/blocks/sapling_oak")
    .button("Go Back to Last Location", "textures/ui/arrow_left");
world.beforeEvents.itemUse.subscribe((event) => {
    //
    /*
     * ****
     *
     * Code for debugging
     * DELETE ME WHEN FINISHING
     */
    if (event.itemStack.typeId === "minecraft:arrow") {
        event.source.clearDynamicProperties();
        world.clearDynamicProperties();
        event.source.sendMessage("Properties cleared.");
        return;
    }
    if (event.itemStack.typeId === "speedister:warper") {
        const player = event.source;
        system.run(() => {
            showMainMenu(player);
        });
    }
});
world.beforeEvents.chatSend.subscribe((event) => {
    let message = event.message;
    const sender = event.sender;
    if (message.startsWith(">")) {
        event.cancel = true;
        message = message.replaceAll(/\s+(?=([^"]*"[^"]*")*[^"]*$)/g, "(|)");
        message = message.replaceAll('"', "");
        const tokenizedCmd = message.split("(|)");
        tokenizedCmd[0] = tokenizedCmd[0].toLowerCase();
        let nameOfItem = "";
        if (tokenizedCmd.length > 1) {
            nameOfItem = tokenizedCmd[1];
        }
        else if (tokenizedCmd[0].includes("home")) {
            nameOfItem = "Home";
        }
        else if (tokenizedCmd[0].includes("warp")) {
            nameOfItem = "Warp";
        }
        const listOfHomes = getHomeList(sender);
        const listOfWarps = getWarpList();
        switch (tokenizedCmd[0]) {
            case ">back": {
                back(sender);
                break;
            }
            case ">checkloc": {
                if (tokenizedCmd.length < 3 ||
                    (tokenizedCmd[1].toLowerCase() !== "home" &&
                        tokenizedCmd[1].toLowerCase() !== "warp")) {
                    sender.sendMessage(`§cIncorrect command usage. Please use ">checkloc (home|warp) (name of home or warp)"`);
                    return;
                }
                const typeOfLoc = tokenizedCmd[1].toLowerCase();
                const nameOfLoc = tokenizedCmd[2];
                const selectedLoc = typeOfLoc === "home"
                    ? searchHomeList(nameOfLoc, getHomeList(sender))
                    : searchWarpList(nameOfLoc, getWarpList());
                if (!selectedLoc) {
                    sender.sendMessage(`§cCould not find the ${typeOfLoc} "${nameOfLoc}§r§c" to check.`);
                    return;
                }
                const { loaded, valid, air, sturdyFloor } = checkSafety(selectedLoc.location, selectedLoc.dimension);
                sender.sendMessage(`\n§eStatus of "${selectedLoc.name}§r§e"` +
                    displayChecks(loaded, valid, air, sturdyFloor));
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
            //
            //
            // ***
            //
            //
            // POTENTIALLY ADD PAGINATION TO HELP
            //
            //
            //
            //
            case ">help":
                if (tokenizedCmd.length < 2) {
                    let outPutStr = "§eList of available commands:\n";
                    for (const prop in CMD_DICTIONARY) {
                        outPutStr = `${outPutStr}\n\n§b>${prop}${CMD_DICTIONARY[prop][0]}§9: ${CMD_DICTIONARY[prop][1]}`;
                    }
                    sender.sendMessage(outPutStr);
                }
                else if (CMD_DICTIONARY[tokenizedCmd[1]]) {
                    const prop = CMD_DICTIONARY[tokenizedCmd[1]];
                    sender.sendMessage(`\n§b>${tokenizedCmd[1]}${prop[0]}§9: ${prop[1]}`);
                }
                else {
                    sender.sendMessage("§cUnknown command to search.");
                }
                break;
            case ">home": {
                const selectedHome = searchHomeList(nameOfItem, listOfHomes);
                if (!selectedHome) {
                    homeErrorMsg(sender, nameOfItem);
                    return;
                }
                goToHome(sender, selectedHome);
                break;
            }
            case ">homebal": {
                const homeBal = getHomeBal(sender);
                const helperStr = homeBal > 0 ? "§a" : "§c";
                sender.sendMessage(`§eRemaining available home slots: ${helperStr}${homeBal}`);
                break;
            }
            case ">listhomes": {
                const listOfHomesLen = listOfHomes.length;
                if (listOfHomesLen < 1) {
                    sender.sendMessage("§eNo homes set for this player.");
                    return;
                }
                let strToPrint = "§6List of your homes: ";
                for (let i = 0; i < listOfHomesLen; i++) {
                    if (i !== listOfHomesLen - 1) {
                        strToPrint = strToPrint + listOfHomes[i].name + ", ";
                    }
                    else {
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
                    let warpName = listOfWarps[i].name;
                    if (listOfWarps[i].owner.id === sender.id)
                        warpName = warpName + " (owned by you)";
                    if (i !== listOfWarpsLen - 1) {
                        strToPrint = strToPrint + warpName + ", ";
                    }
                    else {
                        strToPrint = strToPrint + warpName;
                    }
                }
                sender.sendMessage(strToPrint);
                break;
            }
            case ">s": {
                const spawn = searchWarpList("Spawn", getWarpList());
                if (!spawn) {
                    sender.sendMessage("§cSpawn hasn't been set yet.");
                    return;
                }
                else
                    goToWarp(sender, spawn);
                break;
            }
            case ">sethome":
                setHome(sender, sender.location, sender.dimension.id, nameOfItem);
                break;
            case ">setspawn": {
                if (sender.name !== "Speedister") {
                    sender.sendMessage("§4Permission denied.");
                    return;
                }
                system.run(() => world.setDefaultSpawnLocation(sender.location));
                setWarp(sender, sender.location, sender.dimension.id, true, "Spawn");
                break;
            }
            case ">setwarp":
                setWarp(sender, sender.location, sender.dimension.id, false, nameOfItem);
                break;
            case ">setwarpdef":
                if (sender.name !== "Speedister") {
                    sender.sendMessage("§4Permission denied.");
                    return;
                }
                if (tokenizedCmd.length < 2) {
                    sender.sendMessage(`§cIncorrect command usage. Please use ">setwarpdef (name)"`);
                    return;
                }
                setWarp(sender, sender.location, sender.dimension.id, true, nameOfItem);
                break;
            case ">spawn": {
                const spawn = searchWarpList("Spawn", getWarpList());
                if (!spawn) {
                    sender.sendMessage("§cSpawn hasn't been set yet.");
                    return;
                }
                else
                    goToWarp(sender, spawn);
                break;
            }
            case ">warp": {
                const selectedWarp = searchWarpList(nameOfItem, listOfWarps);
                if (!selectedWarp) {
                    warpErrorMsg(sender, nameOfItem);
                    return;
                }
                goToWarp(sender, selectedWarp);
                break;
            }
            case ">warpbal": {
                const warpBal = getWarpBal(sender);
                const helperStr = warpBal > 0 ? "§a" : "§c";
                sender.sendMessage(`§eRemaining available warp slots: ${helperStr}${warpBal}`);
                break;
            }
            default:
                sender.sendMessage(`§eUnknown command. Type ">help" (without the quotations) for more info.`);
        }
    }
});
