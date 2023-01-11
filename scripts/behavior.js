// **** Constants ****

const TAG_COLORS = [
    "#1f77b4","#ff7f0e","#2ca02c","#d62728","#9467bd","#8c564b","#e377c2","#7f7f7f","#bcbd22","#17becf", // Category10
    "#1b9e77","#d95f02","#7570b3","#e7298a","#66a61e","#e6ab02","#a6761d","#666666", // Dark2
    //"#8dd3c7","#ffffb3","#bebada","#fb8072","#80b1d3","#fdb462","#b3de69","#fccde5","#d9d9d9","#bc80bd","#ccebc5","#ffed6f", // Set3
    //"#4e79a7","#f28e2c","#e15759","#76b7b2","#59a14f","#edc949","#af7aa1","#ff9da7","#9c755f","#bab0ab" // Tableau10
];

const NUM_TAG_COLORS = TAG_COLORS.length;

// **** Global variables ****

// Currently selected tags in the word cloud
let g_selectedTags = [];

// Currently selected time range
let g_timeRange = [];

// For each tag, whether there is at least 1 game with that tag and all of the selected tags
let g_useTag;
// For each id, whether that game has all of the selected tags
let g_useId;
let g_usePid;

// Flag to change between games and publishers
let g_isPublishers = false;


// **** Global constants ****

// Datasets (without any changes or filters)
let g_tags;
let g_playerCountHistory;
let g_playerCountHistoryP;
let g_info;
let g_publishers;
let g_pgdr; // Array with all PGDR values
let g_pgdrP;
let g_parallelInfo; // Array with info for parallel coord
let g_parallelInfoP; // Array with info for parallel coord

// Array with all tags
let g_allTags;

// Array with suggested tags
let g_suggestedTags;

// Array with all ids
let g_allIds;
let g_allPids;

// For each id, whether or not it has each tag
let g_hasTag;
let g_hasTagP;

// For each id, its name
let g_idToName;
let g_idToNameP;

// For each tag, its color
let g_tagToColor;

// Dict with arrays of publishers for each game
let g_gamePublishers;



// **** Functions ****

function init() {
    Promise
        .all([
            d3.csv("data/tags.csv"), 
            d3.csv("data/playerCountHistory.csv"),
            d3.csv("data/information.csv"),
            d3.csv("data/info.csv"),
            d3.csv("data/pgdr.csv"),
            d3.csv("data/publishers.csv"),
            d3.csv("data/playerCountHistory_p.csv"),
            d3.csv("data/info_p.csv"),
            d3.csv("data/pgdr_p.csv")
        ])
        .then(([tags, playerCountHistory, info, parallelInfo, pgdr, publishers, playerCountHistoryP, parallelInfoP, pgdrP]) => {
            initIdioms();
            createSlider();

            g_tags = tags;
            g_playerCountHistory = playerCountHistory;
            g_playerCountHistoryP = playerCountHistoryP;
            g_info = info;
            g_pgdr = pgdr;
            g_pgdrP = pgdrP;
            g_parallelInfo = parallelInfo;
            g_parallelInfoP = parallelInfoP;
            g_publishers = publishers;
            [g_allTags, g_allIds, g_allPids] = getAllTagsAndIds(); //all ids for publishers
            g_suggestedTags = g_allTags.slice();
            g_gamePublishers = createGamePublishers();
            g_hasTag = createHasTagDict();
            g_hasTagP = createHasTagDictP();
            g_idToName = createIdToNameDict();
            g_idToNameP = createIdToNameDictP();
            g_tagToColor = createTagToColorDict();
            
            switchToGames();
            updatePlots(false);
        })
        .catch((error) => {
            console.log(error);
        });
}

function initIdioms() {
    initWordCloud();
    initDotPlot();
    initSmallMultiples();
    initDivergingPlot();
    initParallelCoordinates();
}

function getAllTagsAndIds() {
    const allTags = Object.getOwnPropertyNames(g_tags[0]);
    allTags.splice(allTags.indexOf("id"), 1);

    const allIds = [];
    g_tags.forEach(row => 
        allIds.push(row["id"])
    );

    const allPids = [];
    g_publishers.forEach(row => {
        if (!allPids.includes(row["publisher_id"]))
            allPids.push(row["publisher_id"])
    });

    return [allTags, allIds, allPids];
}

function createGamePublishers(){
    const gamePublishers = {};

    for (let row of g_publishers){
        const id = row["id"];
        if (id in gamePublishers){
            gamePublishers[id].push(row["publisher_id"]);
        }
        else {
            gamePublishers[id] = [row["publisher_id"]];
        }
    }

    return gamePublishers;
}


function createHasTagDict() {
    const hasTag = {};

    for (let row of g_tags) {
        const id = row["id"];
        hasTag[id] = {};
        for (let tag in row)
            if (tag != "id")
                hasTag[id][tag] = (row[tag] == "True");
    }

    return hasTag;
}

//hastagdict for publishers
function createHasTagDictP() {
    const hasTag = {};

    for (let row of g_tags) {
        const pids = g_gamePublishers[row["id"]];
        for (let pid of pids){
            if (!(pid in hasTag))
                hasTag[pid] = {};
            for (let tag in row)
                if (tag != "id"){
                    if (tag in hasTag[pid])
                        hasTag[pid][tag] ||= (row[tag] == "True");
    
                    else{
                        hasTag[pid][tag] = (row[tag] == "True");
                    }
                }
        }
    }

    return hasTag;
}


function createIdToNameDict() {
    const idToName = {};

    for (let row of g_info)
        idToName[row["appid"]] = row["name"];

    return idToName;
}

function createIdToNameDictP() {
    const idToName = {};

    for (let row of g_publishers)
        idToName[row["publisher_id"]] = row["publisher"];

    return idToName;
}

function createTagToColorDict() {
    const tagToColor = {};

    for (let i = 0; i < g_allTags.length; i ++)
        tagToColor[g_allTags[i]] = TAG_COLORS[i % NUM_TAG_COLORS];

    return tagToColor;
}

function getIdsToUse() {
    const idsToUse = [];
    g_allIds.forEach(ids => {
        if (g_useId[ids])
            idsToUse.push(ids);
    });
    return idsToUse;
}

//idstouse for publishers
function getIdsToUseP() {
    const idsToUse = [];
    g_allPids.forEach(ids => {
        if (g_usePid[ids])
            idsToUse.push(ids);
        
    });
    return idsToUse;
}


function getTagsToUse() {
    const tagsToUse = [];
    g_allTags.forEach(tag => {
        if (g_useTag[tag])
            tagsToUse.push(tag);
    });
    return tagsToUse;
}

function filterBySelectedTags() {
    return g_playerCountHistory.filter(row => {
        const id = row["appid"];
        for (let tag of g_selectedTags)
            if (!g_hasTag[id][tag])
                return false;
        return true;
    });
}

function filterBySelectedTagsP() {
    return g_playerCountHistoryP.filter(row => {
        const id = row["pid"];
        for (let tag of g_selectedTags)
            if (!g_hasTagP[id][tag])
                return false;
        return true;
    });
}

function filterBySelectedIds(filteredPCH, selectedIds){   	
    let filteredIds = [];
    for(let row in filteredPCH){
        if(selectedIds.includes(filteredPCH[row]["appid"])){
            filteredIds.push(filteredPCH[row])
        }
    }
    return filteredIds;
}

function filterBySelectedIdsP(filteredPCH, selectedIds){   	
    console.log(selectedIds)
    let filteredIds = [];
    for(let row in filteredPCH){
        if(selectedIds.includes(filteredPCH[row]["pid"])){
            filteredIds.push(filteredPCH[row])
        }
    }
    return filteredIds;
}

function filterTagsAndIds(filteredPlayerCountHistory) {
    const useTag = {};
    const useId = {};

    for (let tag of g_allTags)
        useTag[tag] = false;

    for (let id of g_allIds)
        useId[id] = false;
    
    for (let row of filteredPlayerCountHistory) {
        useId[row["appid"]] = true;
        for (let tag of g_allTags)
            if (g_hasTag[row["appid"]][tag])
                useTag[tag] = true;
    }
        
    return [useTag, useId];
}

function filterTagsAndIdsP(filteredPlayerCountHistory) {
    const useTag = {};
    const useId = {};

    for (let tag of g_allTags)
        useTag[tag] = false;

    for (let id of g_allPids)
        useId[id] = false;
    
    for (let row of filteredPlayerCountHistory) {
        useId[row["pid"]] = true;
        for (let tag of g_allTags)
            if (g_hasTagP[row["pid"]][tag])
                useTag[tag] = true;
    }
        
    return [useTag, useId];
}

function computePlayerCounts(playerCountHistory) {
    const playerCounts = {};
    const timeParse = d3.timeParse('%m %Y');


    for (let row of playerCountHistory) {
        const id = row["appid"];
        var parsedRowTime = timeParse(row["Month"] + " " + row["Year"])
        if (parsedRowTime >= g_timeRange[0] &&
        parsedRowTime <= g_timeRange[1]){
            
            if (id in playerCounts) {
                playerCounts[id]["num"] += Number.isNaN(parseFloat(row["mean"])) ? 0 : parseFloat(row["mean"]);
                playerCounts[id]["peak"] += Number.isNaN(parseFloat(row["max"])) ? 0 : parseFloat(row["max"]);
                playerCounts[id]["n"] ++;
            }
            else {
                playerCounts[id] = {
                    "num": parseFloat(row["mean"]),
                    "peak": parseFloat(row["max"]),
                    "n": 1
                }
            }
        }
    }

    return playerCounts;
}

function computePlayerCountsP(playerCountHistory) {
    const playerCounts = {};
    const timeParse = d3.timeParse('%m %Y')

    for (let row of playerCountHistory) {
        const id = row["pid"];
        var parsedRowTime = timeParse(row["Month"] + " " + row["Year"])
        if (parsedRowTime >= g_timeRange[0] &&
        parsedRowTime <= g_timeRange[1]){
            
            if (id in playerCounts) {
                playerCounts[id]["num"] += Number.isNaN(parseFloat(row["mean"])) ? 0 : parseFloat(row["mean"]);
                playerCounts[id]["peak"] += Number.isNaN(parseFloat(row["max"])) ? 0 : parseFloat(row["max"]);
                playerCounts[id]["n"] ++;
            }
            else {
                playerCounts[id] = {
                    "num": parseFloat(row["mean"]),
                    "peak": parseFloat(row["max"]),
                    "n": 1
                }
            }
        }
    }

    return playerCounts;
}


function getNumAndPeakPlayersPerTag(playerCounts) {
    const idsToUse = getIdsToUse();
    const tagsToUse = getTagsToUse().filter(tag => {
        for (let selectedTag of g_selectedTags)
            if (tag == selectedTag)
                return false;
        return true;
    });

    const data = [];

    for (let tag of tagsToUse) {
        let n = 0;
        let num_players = 0;
        let peak_players = 0;
        for (let id of idsToUse) {
            if (g_hasTag[id][tag]) {
                const playerCount = playerCounts[id];
                n += playerCount["n"];
                num_players += playerCount["num"];
                peak_players += playerCount["peak"];
            }
        }
        if (n > 0) {
            data.push({"tag": tag, "value": num_players / n, "type": "num"});
            data.push({"tag": tag, "value": peak_players / n, "type": "peak"});
        }
    }
        
    return data;
}

function getNumAndPeakPlayersPerTagP(playerCounts) {
    const idsToUse = getIdsToUseP();
    const tagsToUse = getTagsToUse().filter(tag => {
        for (let selectedTag of g_selectedTags)
            if (tag == selectedTag)
                return false;
        return true;
    });

    const data = [];

    for (let tag of tagsToUse) {
        let n = 0;
        let num_players = 0;
        let peak_players = 0;
        for (let id of idsToUse) {
            if (g_hasTagP[id][tag]) {
                const playerCount = playerCounts[id];
                n += playerCount["n"];
                num_players += playerCount["num"];
                peak_players += playerCount["peak"];
            }
        }
        if (n > 0) {
            data.push({"tag": tag, "value": num_players / n, "type": "num"});
            data.push({"tag": tag, "value": peak_players / n, "type": "peak"});
        }
    }
        
    return data;
}

function getTopTagsByNumPlayers(numAndPeakPlayersPerTag, n) {
    const data_num = numAndPeakPlayersPerTag.filter(d => d["type"] == "num");

    data_num
        .sort((pc1, pc2) => pc2["value"] - pc1["value"]);
    
    if (n >= 0) {
        data_num.splice(n);
    }

    return data_num;
}

function getFilteredPGDR() {
    const filteredPGDRDict = {};
    const timeParse = d3.timeParse('%Y-%m');

    for (let row of g_pgdr) {
        const id = row["appid"];
        const parsedRowTime = timeParse(row["Date"].substring(0, row["Date"].length - 3));
        if (parsedRowTime >= g_timeRange[0] && parsedRowTime <= g_timeRange[1]) {
            if (id in filteredPGDRDict) {
                filteredPGDRDict[id]["sum"] += parseFloat(row["PGDR"]);
                filteredPGDRDict[id]["count"] ++;
            }
            else
                filteredPGDRDict[id] = {
                    "sum": parseFloat(row["PGDR"]),
                    "count": 1
                };
        }
    }

    const filteredPGDR = [];
    for (let id in filteredPGDRDict) {
        const pgdr = filteredPGDRDict[id];
        filteredPGDR.push({
            "appid": id,
            "PGDR": pgdr["sum"] / pgdr["count"]
        });
    }
        
    return filteredPGDR;
}

function getFilteredPGDRP() {
    const filteredPGDRDict = {};
    const timeParse = d3.timeParse('%Y-%m');

    for (let row of g_pgdrP) {
        const id = row["publisher_id"];
        const parsedRowTime = timeParse(row["Date"].substring(0, row["Date"].length - 3));
        if (parsedRowTime >= g_timeRange[0] && parsedRowTime <= g_timeRange[1]) {
            if (id in filteredPGDRDict) {
                filteredPGDRDict[id]["sum"] += parseFloat(row["PGDR"]);
                filteredPGDRDict[id]["count"] ++;
            }
            else
                filteredPGDRDict[id] = {
                    "sum": parseFloat(row["PGDR"]),
                    "count": 1
                };
        }
    }

    const filteredPGDR = [];
    for (let id in filteredPGDRDict) {
        const pgdr = filteredPGDRDict[id];
        filteredPGDR.push({
            "appid": id,
            "PGDR": pgdr["sum"] / pgdr["count"]
        });
    }
        
    return filteredPGDR;
}

function addShineToTag(tag) {
    d3
        .select("div#word_cloud")
        .select(".words")
        .selectAll("text")
        .classed("word-shine", d => d.text == tag);

    d3
        .select("div#dot_plot")
        .select(".yAxis")
        .selectAll("text")
        .classed("word-shine", d => d == tag);

    d3
        .select("div#barcharts")
        .selectAll(".title")
        .classed("word-shine", d => d == tag);
}

function removeShineFromTag() {
    d3
        .select("div#word_cloud")
        .select(".words")
        .selectAll("text")
        .classed("word-shine", false);

    d3
        .select("div#dot_plot")
        .select(".yAxis")
        .selectAll("text")
        .classed("word-shine", false);

    d3
        .select("div#barcharts")
        .selectAll(".title")
        .classed("word-shine", false);
}

function typeToText(type) {
    return (type == "num") ? "No. players (avg.)" : "Peak players (avg.)";
}

function reset() {
    g_selectedTags = [];
    clearTags();
    clearTagBox();
    resetSlider();
    updatePlots();
    updateSuggestedTags(null, false, true);

}

function switchToGames(){
    var button1 = document.getElementById("toGameButton");
    button1.style.background = "#43c437"
    var button2 = document.getElementById("toPublisherButton");
    button2.style.background = "#efefef"

    if (g_isPublishers) {
        g_isPublishers = false;
        updatePlots();
    }
}

function switchToPublishers(){
    var button1 = document.getElementById("toGameButton");
    button1.style.background = "#efefef"
    var button2 = document.getElementById("toPublisherButton");
    button2.style.background = "#43c437"

    if (!g_isPublishers) {
        g_isPublishers = true;
        updatePlots();
    }
}

function updatePlots(update = true, selectedIds = []) {
    updatePlayerCountPlots(update, selectedIds);
    createWordCloud(update);
}


function updatePlayerCountPlots(update = true, selectedIds = []) {
    if (!g_isPublishers){
        let filteredPCH = filterBySelectedTags();
        if(filteredPCH !== undefined && selectedIds.length > 0){
            if(selectedIds[0] != null)
                filteredPCH = filterBySelectedIds(filteredPCH, selectedIds)
        }
        [g_useTag, g_useId] = filterTagsAndIds(filteredPCH);
        const playerCounts = computePlayerCounts(filteredPCH);
        const numAndPeakPlayersPerTag = getNumAndPeakPlayersPerTag(playerCounts);
        const filteredPGDR = getFilteredPGDR();

        createDotPlot(numAndPeakPlayersPerTag, update);
        createSmallMultiples(numAndPeakPlayersPerTag, playerCounts, update);
        if(selectedIds.length == 0){
            createParallelCoordinates(playerCounts, update);
        }
        createDivergingPlot(filteredPGDR, update);
    }
    
    else {
        let filteredPCH = filterBySelectedTagsP();
        if(filteredPCH !== undefined && selectedIds.length > 0){
            if(selectedIds[0] != null)
                filteredPCH = filterBySelectedIdsP(filteredPCH, selectedIds)
        }
        [g_useTag, g_usePid] = filterTagsAndIdsP(filteredPCH);
        const playerCounts = computePlayerCountsP(filteredPCH);
        const numAndPeakPlayersPerTag = getNumAndPeakPlayersPerTagP(playerCounts);
        const filteredPGDR = getFilteredPGDRP();

        createDotPlot(numAndPeakPlayersPerTag, update);
        createSmallMultiples(numAndPeakPlayersPerTag, playerCounts, update);
        if(selectedIds.length == 0){
            createParallelCoordinates(playerCounts, update);
        }
        createDivergingPlot(filteredPGDR, update);
    }
}
