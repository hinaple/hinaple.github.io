const SCREEN_WIDTH = 1000;
const SCREEN_HEIGHT = 1000;

const BLOCK_SIZE = 125;

const LINE_COUNT = 100;
const ANGLE_BETWEEN_LINES = 0.01;

const canvas = document.getElementById("canvas");
const screenCtx = canvas.getContext("2d");

const minimap = document.getElementById("minimap");
const miniCtx = minimap.getContext("2d");

screenCtx.imageSmoothingEnabled = false;
miniCtx.imageSmoothingEnabled = false;

screenCtx.fillStyle = "#fff";
screenCtx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

miniCtx.fillStyle = "#fff";
miniCtx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

const maps = [
    {
        spawn: [ 4, 4 ],
        map: [
            [ 1, 1, 1, 1, 1, 1, 1, 1 ],
            [ 1, 0, 0, 0, 0, 0, 0, 1 ],
            [ 1, 0, 0, 0, 0, 0, 0, 1 ],
            [ 1, 0, 0, 0, 0, 0, 0, 1 ],
            [ 1, 0, 0, 0, 0, 0, 0, 1 ],
            [ 1, 0, 0, 0, 0, 0, 0, 1 ],
            [ 1, 0, 0, 0, 0, 0, 0, 1 ],
            [ 1, 1, 1, 1, 1, 1, 1, 1 ]
        ]
    },
    {
        spawn: [ 1.5, 1.5 ],
        map: [
            [ 1, 1, 1, 1, 1, 1, 1, 1 ],
            [ 1, 0, 0, 0, 0, 0, 0, 1 ],
            [ 1, 0, 1, 0, 0, 1, 0, 1 ],
            [ 1, 0, 0, 0, 0, 0, 0, 1 ],
            [ 1, 0, 0, 0, 0, 0, 0, 1 ],
            [ 1, 0, 1, 0, 0, 1, 0, 1 ],
            [ 1, 0, 0, 0, 0, 0, 0, 1 ],
            [ 1, 1, 1, 1, 1, 1, 1, 1 ]
        ]
    },
    {
        spawn: [ 4, 4 ],
        map: [
            [ 1, 1, 1, 1, 1, 1, 1, 1 ],
            [ 1, 0, 1, 0, 0, 0, 0, 1 ],
            [ 1, 0, 1, 0, 0, 0, 0, 1 ],
            [ 1, 0, 1, 0, 0, 0, 0, 1 ],
            [ 1, 0, 0, 0, 0, 0, 0, 1 ],
            [ 1, 0, 0, 0, 0, 1, 0, 1 ],
            [ 1, 0, 0, 0, 0, 0, 0, 1 ],
            [ 1, 1, 1, 1, 1, 1, 1, 1 ]
        ]
    },
    {
        spawn: [ 5.5, 6.5 ],
        map: [
            [ 1, 1, 1, 1, 1, 1, 1, 1 ],
            [ 1, 0, 1, 0, 0, 0, 0, 1 ],
            [ 1, 0, 1, 0, 1, 0, 1, 1 ],
            [ 1, 0, 1, 0, 1, 0, 0, 1 ],
            [ 1, 0, 1, 0, 1, 1, 0, 1 ],
            [ 1, 0, 1, 0, 1, 1, 0, 1 ],
            [ 1, 0, 0, 0, 1, 0, 0, 1 ],
            [ 1, 1, 1, 1, 1, 1, 1, 1 ]
        ]
    },
];

let nowMap = 0;
let map = [
    [ 1, 1, 1, 1, 1, 1, 1, 1 ],
    [ 1, 0, 0, 0, 0, 0, 0, 1 ],
    [ 1, 0, 0, 0, 0, 0, 0, 1 ],
    [ 1, 0, 0, 0, 0, 0, 0, 1 ],
    [ 1, 0, 0, 0, 0, 0, 0, 1 ],
    [ 1, 0, 0, 0, 0, 0, 0, 1 ],
    [ 1, 0, 0, 0, 0, 0, 0, 1 ],
    [ 1, 1, 1, 1, 1, 1, 1, 1 ]
];

let player = {
    pos: [ 4, 4 ],
    press: [ 
        [ false, false, false, false ], //move to [ up left down right ]
        [ false, false ] //turn to [ left right ]
    ],
    delta: [ 0, 0 ], //delta [ x y ]
    angle: 0 //radian angle
}

function copyArray(arr1) {
    let arr2 = [];
    for(let i = 0; i < arr1.length; i++) {
        arr2.push(arr1[i]);
    }
    return arr2;
}

setInterval(rend2d, 15);

async function rend2d() {
    calculatePlayerDelta();
    screenCtx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    miniCtx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    drawMap2d(miniCtx);
    drawPlayer2d(miniCtx);
    await calculateLines();
    drawPlayerLine(miniCtx);
    movePlayer();
}

function calculatePlayerDelta() {
    if(player.angle < 0) player.angle += Math.PI * 2;
    else if(player.angle > Math.PI * 2) player.angle -= Math.PI * 2;

    player.delta[0] = Math.cos(player.angle);
    player.delta[1] = Math.sin(player.angle);
}

function calculateLines() {
    return new Promise(async res => {
        let tilePosX = player.pos[0] % 1;
        let tilePosY = player.pos[1] % 1;
        for(let i = 0; i < LINE_COUNT; i++) {
            let lineAngle = player.angle + (i - LINE_COUNT / 2) * ANGLE_BETWEEN_LINES;
            if(lineAngle < 0) lineAngle += Math.PI * 2;
            else if(lineAngle > Math.PI * 2) lineAngle -= Math.PI * 2;

            let xOffset, yOffset, hitXH, hitXV, hitYH, hitYV, lineLength = 0;
            if(lineAngle == Math.PI || lineAngle == 0) lineAngle += 0.0001;
            
            let angleTan = Math.tan(lineAngle);

            //check horizon
            if(lineAngle > Math.PI) { //looking down
                hitYH = player.pos[1] - tilePosY - 0.005;
                hitXH = player.pos[0] - tilePosY / angleTan;
                yOffset = -1;
                xOffset = yOffset / angleTan;
            }
            else if(lineAngle < Math.PI) { //looing up
                hitYH = player.pos[1] + 1 - tilePosY + 0.005;
                hitXH = player.pos[0] + (1 - tilePosY) / angleTan;
                yOffset = 1;
                xOffset = yOffset / angleTan;
            }
            for(lineLength; lineLength < 12; lineLength++) {
                if(!(hitYH < 8 && hitYH >= 0
                    && hitXH < 8 && hitXH >= 0)) {
                    hitXH += xOffset * 8;
                    hitYH += yOffset * 8;
                    break;
                }
                if(map[Math.floor(hitYH)]
                    [Math.floor(hitXH)]) {
                    break;
                }
                hitXH += xOffset;
                hitYH += yOffset;
            }

            //check vertical
            if(lineAngle > Math.PI / 2 && lineAngle < Math.PI * 3 / 2) { //looking left
                hitXV = player.pos[0] - tilePosX - 0.005;
                hitYV = player.pos[1] - tilePosX * angleTan;
                xOffset = -1;
                yOffset = xOffset * angleTan;
            }
            else if(lineAngle < Math.PI / 2 || lineAngle > Math.PI * 3 / 2) { //looing right
                hitXV = player.pos[0] + 1 - tilePosX + 0.005;
                hitYV = player.pos[1] + (1 - tilePosX) * angleTan;
                xOffset = 1;
                yOffset = xOffset * angleTan;
            }

            for(lineLength; lineLength < 12; lineLength++) {
                if(!(hitYV < 8 && hitYV >= 0
                    && hitXV < 8 && hitXV >= 0)) {
                    hitXV += xOffset * 8;
                    hitYV += yOffset * 8;
                    break;
                }
                if(map[Math.floor(hitYV)]
                    [Math.floor(hitXV)]) break;
                hitXV += xOffset;
                hitYV += yOffset;
            }

            let hitX, hitY, shortLen;
            
            let horizonLen = getLengthBetween([hitXH, hitYH], player.pos);
            let verticalLen = getLengthBetween([hitXV, hitYV], player.pos);
            //console.log(hitXH, hitYH, hitXV, hitYV); //catch errors
            let isVerticalBig = horizonLen < verticalLen
            shortLen = isVerticalBig? horizonLen: verticalLen;
            hitX = isVerticalBig? hitXH: hitXV;
            hitY = isVerticalBig? hitYH: hitYV;
            let relativeAngle = player.angle - lineAngle;
            if(relativeAngle < 0) relativeAngle += Math.PI * 2;
            else if(relativeAngle > Math.PI * 2) relativeAngle -= Math.PI * 2;
            shortLen *= Math.cos(relativeAngle);
            await drawCastLine(miniCtx, hitX, hitY).then(() => {
                if(i == LINE_COUNT - 1) res(); //For Async
            });
            await drawAPixelLine(screenCtx, i, shortLen, isVerticalBig? "#525252": "#808080").then(() => {
                if(i == LINE_COUNT - 1) res(); //For Async
            });
        }
    });
}

function getLengthBetween(pos1, pos2) {
    return Math.sqrt(Math.pow(pos1[0] - pos2[0], 2) + Math.pow(pos1[1] - pos2[1], 2));
}

function drawCastLine(ctx, dx, dy, color = "red", width = 3) {
    return new Promise(res => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;

        ctx.beginPath();
        ctx.moveTo(player.pos[0] * BLOCK_SIZE, player.pos[1] * BLOCK_SIZE);
        ctx.lineTo(
            dx * BLOCK_SIZE,
            dy * BLOCK_SIZE
        );
        ctx.stroke();

        res([dx, dy]);
    });
}

function drawAPixelLine(ctx, index, depth, color = "gray") {
    return new Promise(res => {
        ctx.fillStyle = color;
        ctx.fillRect(
            index * (SCREEN_WIDTH / LINE_COUNT),
            SCREEN_HEIGHT / 2 - 8 / depth * 50,
            SCREEN_WIDTH / LINE_COUNT,
            8 / depth * 100
        );

        res();
    });
}

function drawPlayer2d(ctx) {
    ctx.fillStyle = "#000";
    ctx.fillRect(
        player.pos[0] * BLOCK_SIZE - 10,
        player.pos[1] * BLOCK_SIZE - 10,
        20, 20
    );
}

function drawMap2d(ctx) {
    ctx.fillStyle = "#000";
    ctx.strokeStyle = "gray";
    ctx.lineWidth = 3;
    for(let i = 0; i < map.length; i++) {
        for(let j = 0; j < map[i].length; j++) {
            if(map[i][j])
                ctx.fillRect(j * BLOCK_SIZE, i * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
            ctx.strokeRect(j * BLOCK_SIZE, i * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        }
    }
}

function drawPlayerLine(ctx) {
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 10;

    ctx.beginPath();
    ctx.moveTo(player.pos[0] * BLOCK_SIZE, player.pos[1] * BLOCK_SIZE);
    ctx.lineTo(
        player.pos[0] * BLOCK_SIZE + player.delta[0] * 50,
        player.pos[1] * BLOCK_SIZE + player.delta[1] * 50
    )
    ctx.stroke();
}

function movePlayer() {
    let tempPos = copyArray(player.pos);

    if(player.press[0][0]) {
        tempPos[0] += player.delta[0] / 20;
        tempPos[1] += player.delta[1] / 20;

        if(map[Math.floor(tempPos[1])][Math.floor(tempPos[0])]) tempPos = copyArray(player.pos);
        else player.pos = copyArray(tempPos);
    }
    if(player.press[0][1]) {
        tempPos[0] += player.delta[1] / 20;
        tempPos[1] -= player.delta[0] / 20;

        if(map[Math.floor(tempPos[1])][Math.floor(tempPos[0])]) tempPos = copyArray(player.pos);
        else player.pos = copyArray(tempPos);
    }
    if(player.press[0][2]) {
        tempPos[0] -= player.delta[0] / 20;
        tempPos[1] -= player.delta[1] / 20;

        if(map[Math.floor(tempPos[1])][Math.floor(tempPos[0])]) tempPos = copyArray(player.pos);
        else player.pos = copyArray(tempPos);
    }
    if(player.press[0][3]) {
        tempPos[0] -= player.delta[1] / 20;
        tempPos[1] += player.delta[0] / 20;

        if(map[Math.floor(tempPos[1])][Math.floor(tempPos[0])]) tempPos = copyArray(player.pos);
        else player.pos = copyArray(tempPos);
    }

    if(player.press[1][0]) player.angle -= 0.05;
    if(player.press[1][1]) player.angle += 0.05;
}

document.body.addEventListener("keydown", () => {
    if(event.keyCode == 87) player.press[0][0] = true;
    if(event.keyCode == 65) player.press[0][1] = true;
    if(event.keyCode == 83) player.press[0][2] = true;
    if(event.keyCode == 68) player.press[0][3] = true;

    if(event.keyCode == 37) player.press[1][0] = true;
    if(event.keyCode == 39) player.press[1][1] = true;
});

document.body.addEventListener("keyup", () => {
    if(event.keyCode == 87) player.press[0][0] = false;
    if(event.keyCode == 65) player.press[0][1] = false;
    if(event.keyCode == 83) player.press[0][2] = false;
    if(event.keyCode == 68) player.press[0][3] = false;

    if(event.keyCode == 37) player.press[1][0] = false;
    if(event.keyCode == 39) player.press[1][1] = false;
});

document.getElementById("mapChange").addEventListener("click", () => {
    nowMap++;
    if(nowMap >= maps.length) nowMap = 0;

    player.pos = copyArray(maps[nowMap].spawn);
    map = copyArray(maps[nowMap].map);
});