const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

ctx.imageSmoothingEnabled = false;

const SCREEN_WIDTH = 1440;
const SCREEN_HEIGHT = 810;

const INVEN_SCALE = 200;

const BLOCK_GROUP = 10; //블록 묶음의 한 변의 길이
const MAX_Y = 200; //Y축 최대 높이

let time = 0;
let pause = false;

let blockData = [
    {
        passable: true,
    }, {
        passable: false,
    }, {
        passable: false,
    }, {
        passable: false,
    }, {
        passable: true
    }
];

const itemData = [

]

for(let i = 1; i < blockData.length; i++) {
    blockData[i].img = new Image();
    blockData[i].img.src = "sprites/blocks/" + i + ".png";
}

class Block {
    constructor(id) {
        this.id = id;
    }
}

class Item {
    constructor(type, id, x, y, cnt) { //type = false -> block, type = true -> item
        this.type = type;
        this.id = id;
        if(!this.type) this.scale = 20;
        else this.scale = itemData[this.id].scale;
        this.pos = [x, y];
        this.count = cnt;
    }
}

let scale = 100; //블록 한 개의 크기
let camera = [-100, -100]; //x, y
let player = {
    grv: 0, //중력
    jumping: false,
    jumpDir: false,
    running: false,
    moving: [false, false], //isMoving, dir
    press: [false, false, false, false], //3rd, 4th index mean ladder press
    pos: [scale / 2, MAX_Y / 2 * scale], //x, y (몸 중앙)
    prvPos: [0, 0], //바로 전 프레임의 위치
    inv: [], //inventory
    scale: [50, 180], //width, height
    viewScale: [72, 180],
    imgs: [],
    onLadder: false,
    setBlock: 3,
}

for(let i = 0; i < 2; i++) {
    player.imgs.push([]);
    for(let j = 0; j < 2; j++) {
        player.imgs[i].push(new Image());
        player.imgs[i][j].src = "sprites/chars/wak/" + (j == 0? '': 'r') + i + ".png";
    }
}
for(let i = 0; i < 4; i++) {
    player.imgs.push([]);
    for(let j = 0; j < 2; j++) {
        player.imgs[i + 2].push(new Image());
        player.imgs[i + 2][j].src = "sprites/chars/wak/walk" + (j == 0? '': 'r') + i + ".png";
    }
}
for(let i = 0; i < 2; i++) {
    player.imgs.push([]);
    for(let j = 0; j < 2; j++) {
        player.imgs[i + 6].push(new Image());
        player.imgs[i + 6][j].src = "sprites/chars/wak/fall" + (j == 0? '': 'r') + i + ".png";
    }
}
for(let i = 0; i < 2; i++) {
    player.imgs.push(new Image());
    player.imgs[i + 8].src = "sprites/chars/wak/ladder" + i + ".png";
}

let world = {
    center: 0,
    blocks: [ [], [] ],
    selected: [null, null], //x, y, possible to edit
    pointer: [null, null],
    entities: [],
    sky: ctx.createLinearGradient(0, 0, 0, SCREEN_HEIGHT),
};
world.sky.addColorStop(0, "#7afbff");
world.sky.addColorStop(1, "#f0ffff");

let sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function rowsMethod(prvHeight, up) { //각 행 생성
    let temp = [ [], [] ];
    let nowBlock = 0; //현재 채워지는 블럭
    let rnd = Math.floor(Math.random() * 2);
    for(let j = 0; j < MAX_Y; j++) {
        if(j >= MAX_Y - 1) nowBlock = 3;
        else if(j >= prvHeight + (rnd * up)) nowBlock = 1;
        else nowBlock = 0;

        temp[0].push(new Block(nowBlock));
        temp[1].push(new Block(nowBlock));
    }
    return {
        row: temp,
        height: prvHeight + (rnd * up)
    };
}

function genWorld(right) { //BLOCK_GROUP만큼 왼쪽 혹은 오른쪽으로 맵 생성
    let res = {};
    let up = 1;
    if(world.blocks[1].length == 0) res.height = MAX_Y / 2;
    else {
        for(let i = 0; i < MAX_Y; i++) {
            if(world.blocks[1][right? world.blocks[1].length - 1: 0][i].id != 0) {
                res.height = i;
                break;
            }
        }
    }
    for(let i = right? 0: BLOCK_GROUP - 1; (i < BLOCK_GROUP && right) || (i >= 0 && !right); i += right? 1: -1) {
        if(world.blocks[1].length == 0) up = 0;
        else if(res.height >= MAX_Y - 50) up = -1;
        else if(res.height <= 50) up = 1;
        else if(Math.random() <= 0.4) up *= -1;
        else if(up == 0) up = Math.abs(Math.random())? -1: 1;
        res = rowsMethod(res.height, up);
        if(right) {
            world.blocks[0].push(res.row[0]);
            world.blocks[1].push(res.row[1]);
        }
        else {
            world.blocks[0].unshift(res.row[0]);
            world.blocks[1].unshift(res.row[1]);
        }
    }
    if(!right) world.center += BLOCK_GROUP;
}

function rend() {
    time++;
    if(time >= 60) time = 0;

    ctx.fillStyle = world.sky;
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    
    let shadowGradient = ctx.createRadialGradient(
        SCREEN_WIDTH / 2,
        SCREEN_HEIGHT / 2,
        0,
        SCREEN_WIDTH / 2,
        SCREEN_HEIGHT / 2,
        SCREEN_WIDTH / 4
    );
    shadowGradient.addColorStop(0, "rgba(0, 0, 0, 0.5)");
    shadowGradient.addColorStop(1, "rgba(0, 0, 0, 0.7)");


    for(let i = 0; i < world.blocks[1].length; i++) {
        if(i < (camera[0] / scale + world.center) - 1 || i > ((camera[0] + SCREEN_WIDTH) / scale + world.center)) continue;
        for(let j = 0; j < world.blocks[1][i].length; j++) {
            if(j < camera[1] / scale - 1 || j >= (camera[1] + SCREEN_HEIGHT) / scale) continue;
            if(world.blocks[0][i][j].id != 0) {
                ctx.drawImage(blockData[world.blocks[0][i][j].id].img, (i - world.center) * scale - camera[0], j * scale - camera[1], scale + 0.5, scale + 0.5);
                ctx.fillStyle = shadowGradient;
                ctx.fillRect((i - world.center) * scale - camera[0], j * scale - camera[1], scale + 0.5, scale + 0.5);
            }
            if(world.blocks[1][i][j].id != 0)
                ctx.drawImage(blockData[world.blocks[1][i][j].id].img, (i - world.center) * scale - camera[0], j * scale - camera[1], scale + 0.5, scale + 0.5);
            if(i == world.selected[0] && j == world.selected[1]) {
                if(world.blocks[0][i][j].id == 0 && world.blocks[1][i][j].id == 0) {
                    ctx.strokeStyle = "#000";
                    ctx.setLineDash([10, 6]);
                    ctx.lineDashOffset = time;
                    ctx.lineWidth = 3;
                    ctx.strokeRect((i - world.center) * scale - camera[0], j * scale - camera[1], scale + 0.5, scale + 0.5);
                }
                else {
                    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
                    ctx.fillRect((i - world.center) * scale - camera[0], j * scale - camera[1], scale + 0.5, scale + 0.5);
                }
            }
        }
    }
    
    let tempImg = null;
    if(player.onLadder) tempImg = player.imgs[(player.moving[2] || player.moving[0]? Math.floor(time / 30) % 2 + 8: 8)];
    else if(player.grv > 0) tempImg = player.imgs[Math.floor(time / 10) % 2 + 6][player.moving[1]? 0: 1];
    else if(player.moving[0]) tempImg = player.imgs[Math.floor(time / (player.running? 8: 15)) % 4 + 2][player.moving[1]? 0: 1];
    else tempImg = player.imgs[Math.floor(time / 30) % 2][player.moving[1]? 0: 1];
    ctx.drawImage(tempImg, player.pos[0] - (player.viewScale[0] / 2) - camera[0], player.pos[1] - player.viewScale[1] - camera[1], player.viewScale[0], player.viewScale[1]);
}

async function jump() {
    if(player.jumping || player.grv != 0 || pause || player.onLadder) return;
    player.jumping = true;
    let j = 0;
    for(let i = 4.5; i >= 0; i -= 0.3) {
        let temp = false;
        j++;
        for(let j = Math.floor((player.pos[0] - (player.scale[0] / 2)) / scale) + world.center; j <= Math.floor((player.pos[0] + (player.scale[0] / 2)) / scale) + world.center; j++) {
            if(!blockData[world.blocks[1][j][Math.floor((player.pos[1] - player.scale[1] - (i * i)) / scale)].id].passable) {
                player.pos[1] = Math.ceil((player.pos[1] - player.scale[1] - (i * i)) / scale) * scale + player.scale[1]
                temp = true;
                break;
            }
        }
        if(temp) break;

        await sleep(15);
        player.pos[1] -= i * i;
    }
    player.jumping = false;
    player.grv = 0.2;
}

function walk(dir, onLadder) {
    if(pause) return;
    if(onLadder) {
        if(dir) {
            for(let j = Math.floor((player.pos[0] - (player.scale[0] / 2)) / scale) + world.center; j <= Math.floor((player.pos[0] + (player.scale[0] / 2)) / scale) + world.center; j++) {
                if(!blockData[world.blocks[1][j][Math.floor((player.pos[1] - player.scale[1] - 3) / scale)].id].passable) {
                    player.pos[1] = Math.ceil((player.pos[1] - player.scale[1] - 3) / scale) * scale + player.scale[1];
                    return;
                }
            }
            player.pos[1] -= 3;
        }
        else {
            for(let j = Math.floor(player.pos[0] / scale) + world.center; j <= Math.floor((player.pos[0] + (player.scale[0] / 2)) / scale) + world.center; j++) {
                if(!blockData[world.blocks[1][j][Math.floor((player.pos[1] + 3) / scale)].id].passable) {
                    player.pos[1] = Math.floor((player.pos[1] + 3) / scale) * scale;
                    return;
                }
            }
            player.pos[1] += 3;
        }
        return;
    }
    if(player.pos[1] % scale > 0.5) lim = Math.ceil(player.scale[1] / scale) + 1;
    else lim = Math.ceil(player.scale[1] / scale);
    
    if(dir) {
        let moveD = 3;
        if(player.running) moveD = 6;
        for(let i = Math.floor((player.pos[1] - player.scale[1]) / scale); i <= Math.floor((player.pos[1] - 1) / scale); i++) {
            if(!blockData[world.blocks[1][Math.floor((player.pos[0] + (player.scale[0] / 2) + moveD) / scale) + world.center][i].id].passable) {
                player.pos[0] = Math.floor((player.pos[0] + (player.scale[0] / 2) + moveD) / scale) * scale - (player.scale[0] / 2) - 1;
                return false;
            }
        }
        player.pos[0] += moveD;
    }
    else {
        let moveD = 3;
        if(player.running) moveD = 6;
        for(let i = Math.floor((player.pos[1] - player.scale[1]) / scale); i <= Math.floor((player.pos[1] - 1) / scale); i++) {
            if(!blockData[world.blocks[1][Math.floor((player.pos[0] - (player.scale[0] / 2) - moveD) / scale) + world.center][i].id].passable) {
                player.pos[0] = Math.ceil((player.pos[0] - (player.scale[0] / 2) - moveD) / scale) * scale + (player.scale[0] / 2) + 1;
                return false;
            }
        }
        player.pos[0] -= moveD;
    }

}

function move() {
    if(pause) return;
    if(player.grv < 8 && !player.jumping && !player.onLadder) player.grv += 0.15;
    if(player.onLadder) player.grv = 0.5;
    
    if(player.onLadder && world.blocks[1][Math.floor(player.pos[0] / scale) + world.center][Math.floor((player.pos[1] - 1) / scale)].id != 4)
        player.onLadder = false;

    let falling = true;
    if(player.moving[2] && player.onLadder) walk(player.moving[3], true);
    if(player.moving[0] && player.moving[1]) walk(true, false);
    else if(player.moving[0] && !player.moving[1]) walk(false, false);

    if((Math.floor(camera[0] / scale) + world.center) * scale <= 0)
    genWorld(false);
    else if((Math.floor(camera[0] / scale) + world.center) * scale + SCREEN_WIDTH >= (world.blocks[1].length - 1) * scale)
    genWorld(true);

    mouseMove();

    for(let i = Math.floor((player.pos[0] - (player.scale[0] / 2)) / scale) + world.center; i <= Math.floor((player.pos[0] + (player.scale[0] / 2)) / scale) + world.center; i++) {
        if(!blockData[world.blocks[1][i][Math.floor((player.pos[1] + (player.grv * player.grv)) / scale)].id].passable) {
            player.pos[1] = Math.floor((player.pos[1] + (player.grv * player.grv)) / scale) * scale;
            player.grv = 0;
            falling = false;
        }
    }
    if(falling) player.pos[1] += player.grv * player.grv;
    player.prvPos[0] = player.pos[0];
    player.prvPos[1] = player.pos[1];
    if(Math.abs(player.pos[0] - (camera[0] + (SCREEN_WIDTH / 2))) > 0.1)
        camera[0] += (player.pos[0] - (camera[0] + (SCREEN_WIDTH / 2))) / 20;
    else camera[0] = player.pos[0] - (SCREEN_WIDTH / 2);
    if(Math.abs(player.pos[1] - player.scale[1] - (camera[1] + (SCREEN_HEIGHT / 2))) > 0.1)
        camera[1] += (player.pos[1] - player.scale[1] - (camera[1] + (SCREEN_HEIGHT / 2))) / 2.5;
    else camera[1] = player.pos[1] - player.scale[1] - (SCREEN_HEIGHT / 2);
    rend();
}

setInterval(move, 15);

function mouseMove() {
    let temp = [
        Math.floor((world.pointer[0] + camera[0]) / scale) + world.center,
        Math.floor((world.pointer[1] + camera[1]) / scale)
    ];
    
    //check the selected position is correct
    if(temp[0] >= Math.floor(player.pos[0] / scale) + world.center - 2
    && temp[0] <= Math.floor(player.pos[0] / scale) + world.center + 2
    && temp[1] >= Math.floor(player.pos[1] / scale) - 3
    && temp[1] <= Math.floor(player.pos[1] / scale) + 1 
    && !(Math.floor((player.pos[0] - (player.scale[0] / 2)) / scale) + world.center <= temp[0]
    && Math.floor((player.pos[0] + (player.scale[0] / 2)) / scale) + world.center >= temp[0]
    && Math.floor((player.pos[1] - 1) / scale) >= temp[1]
    && Math.floor((player.pos[1] - player.scale[1]) / scale) <= temp[1])) {
        world.selected = [ temp[0], temp[1] ];
    }
    else world.selected = [ null, null ];
}

function getMousePos(evt) {
    var rect = canvas.getBoundingClientRect();
    world.pointer = [ evt.clientX - rect.left, evt.clientY - rect.top ];
}

function editWorld(brk) {
    if(world.selected[0] !== null) {
        if(brk) {
            let temp = world.blocks[1][world.selected[0]][world.selected[1]].id;
            if(temp != 0) {
                world.blocks[1][world.selected[0]][world.selected[1]].id = 0;
                //addItem(false, temp, 1);
            }
        }
        else if(world.blocks[1][world.selected[0]][world.selected[1]].id == 0) {
            world.blocks[1][world.selected[0]][world.selected[1]].id = player.setBlock;
        }
    }
    return false;
}

window.onkeypress = () => {
    if(event.keyCode == 105) {
        player.setBlock++;
        if(player.setBlock > 4) player.setBlock = 1;
    }
}

window.onkeyup = () => {
    if(player.moving[2]) {
        if(event.keyCode == 87 || event.keyCode == 38) {
            player.moving[2] = false;
        }
        else if(event.keyCode == 83 || event.keyCode == 40) {
            player.moving[2] = false;
        }
    }
    if(event.keyCode == 68 || event.keyCode == 39) {
        player.press[0] = false;
        if(!player.press[1]) player.moving[0] = false;
        else player.moving[1] = false;
    }
    if(event.keyCode == 16) player.running = false;
    if(event.keyCode == 65 || event.keyCode == 37) {
        player.press[1] = false;
        if(!player.press[0]) player.moving[0] = false;
        else player.moving[1] = true;
    }
}

window.onkeydown = () => {
    if(world.blocks[1][Math.floor(player.pos[0] / scale) + world.center][Math.floor((player.pos[1] - 1) / scale)].id == 4) {
        if(event.keyCode == 87 || event.keyCode == 38) {
            player.moving[2] = true;
            player.moving[3] = true;
            player.onLadder = true;
            return;
        }
        else if(event.keyCode == 83 || event.keyCode == 40) {
            player.moving[2] = true;
            player.moving[3] = false;
            player.onLadder = true;
            return;
        }
    }
    if(event.keyCode == 87 || event.keyCode == 32 || event.keyCode == 38) jump();
    if(event.keyCode == 16) player.running = true;
    if(event.keyCode == 68 || event.keyCode == 39) {
        player.moving[0] = true;
        player.press[0] = true;
        player.moving[1] = true;
    }
    if(event.keyCode == 65 || event.keyCode == 37) {
        player.moving[0] = true;
        player.press[1] = true;
        player.moving[1] = false;
    }
};

genWorld(true);
genWorld(false);
