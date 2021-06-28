//1m = 100px

let Images = {
    items: {
        bomb: new Image(),
        gas: new Image(),
        fluid: new Image(),
        snail: new Image(),
        solid: new Image(),
        ostri: new Image(),
        slime: new Image()
    },
    player: new Image(),
    bakcground: new Image()
}
Images.items.bomb.src = "src/ingame/icon/cbg_bomb.png";
Images.items.gas.src = "src/ingame/icon/icon_ob01.png";
Images.items.fluid.src = "src/ingame/icon/icon_ob02.png";
Images.items.snail.src = "src/ingame/icon/icon_ob03.png";
Images.items.solid.src = "src/ingame/icon/icon_ob04.png";
Images.items.ostri.src = "src/ingame/icon/icon_ob05.png";
Images.items.slime.src = "src/ingame/icon/icon_ob06.png";
Images.player.src = "src/ingame/icon/icon_roket.png";
Images.bakcground.src = "src/title/cbg/cbg_bg.png";

const SOUND = {
    lobby: new Audio("src/sound/lobby.wav"),
    ingame: new Audio("src/sound/ingame.wav"),
    wrong: new Audio("src/sound/wrong.wav"),
    correct: new Audio("src/sound/correct.wav"),
    gooditem: new Audio("src/sound/gooditem.wav"),
    baditem: new Audio("src/sound/baditem.wav"),
    result: new Audio("src/sound/result.wav")
};
SOUND.lobby.loop = true;
SOUND.ingame.loop = true;

function playAudio(name, otherpause = true) {
    if(otherpause) {
        for(let i in SOUND) {
            if(i != name) SOUND[i].pause();
        }
    }
    SOUND[name].currentTime = 0;
    SOUND[name].play();
}

const Screens = {
    pause: document.getElementById("pauseScr"),
    result: document.getElementById("resultScr"),
    main: document.getElementById("main"),
    tuto: document.getElementById("tutoScr")
};

const screenDom = document.getElementById("screen");

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const Hearts = document.getElementsByClassName("heart full");
const Fuels = document.getElementsByClassName("afuel full");

const Buttons = {
    left: document.getElementById("leftButton"),
    right: document.getElementById("rightButton"),
    pause: document.getElementById("pause")
};

const ModeDom = document.getElementById("mode");

let start = null;
let preTimestamp = 0;

let WIDTH = 0;
let HEIGHT = 0;

//const MAXW = 600;
//const MAXH = 900;

let random = n => Math.floor(Math.random() * n);

//S: Solid, F: Fluid, G: Gas
const Modes = [
    { name: '물', material: 'F' },
    { name: '얼음', material: 'S' },
    { name: '질소', material: 'G' },
    { name: '수소', material: 'G' },
    { name: '주스', material: 'F' },
    { name: '산소', material: 'G' },
    { name: '금속', material: 'S' },
    { name: '우유', material: 'F' },
    { name: '껌', material: 'S' },
    { name: '네온', material: 'G' },
    { name: '콜라', material: 'F' },
];
let nodeMode = Modes[0];

const ItemTypes = [
    {
        name: "slime",
        img: Images.items.slime
    }, {
        name: "bomb",
        img: Images.items.bomb
    }, {
        name: "slower",
        img: Images.items.snail
    }, {
        name: "faster",
        img: Images.items.ostri
    }, {
        name: "solid",
        img: Images.items.solid
    }, {
        name: "fluid",
        img: Images.items.fluid
    }, {
        name: "gas",
        img: Images.items.gas
    }
];

let playerStatus = {
    fuel: 0,
    life: 3,
    correctCount: 0,
    score: 0,
    pressing: { left: false, right: false },
    playing: false,
    god: false,
    speed: "normal",
    mode: 0
}
let things = [];

function nextMode() {
    playerStatus.mode++;
    if(playerStatus.mode >= Modes.length) playerStatus.mode = 0;
    ModeDom.innerText = Modes[playerStatus.mode].name;
}

function addHP(n) {
    playerStatus.life += n;
    if(playerStatus.life > 3) playerStatus.life = 3;
    else if(playerStatus.life <= 0) {
        gameOver();
        playerStatus.life = 0;
    }
    updateHearts();
}

function updateHearts() {
    for(let i = 0; i < 3; i++) {
        if(i < playerStatus.life) Hearts[i].style.opacity = 1;
        else Hearts[i].style.opacity = 0;
    }
}

function addFuel(n) {
    if(n < 0 && playerStatus.god) return; 
    playerStatus.fuel += n;
    if(playerStatus.fuel >= 10) {
        addHP(1);
        playerStatus.fuel = 0;
    }
    else if(playerStatus.fuel <= 0) playerStatus.fuel = 0;

    updateFuel();
}

function updateFuel() {
    for(let i = 0; i < 10; i++) {
        if(i < playerStatus.fuel) Fuels[i].style.opacity = 1;
        else Fuels[i].style.opacity = 0;
    }
}

function play(reset = false) {

    playerStatus.playing = true;
    Screens.pause.style.pointerEvents = "none";
    Screens.pause.style.opacity = 0;
    Screens.result.style.pointerEvents = "none";
    Screens.result.style.opacity = 0;
    Screens.main.style.pointerEvents = "none";
    Screens.main.style.opacity = 0;
    Screens.tuto.style.pointerEvents = "none";
    Screens.tuto.style.opacity = 0;

    window.requestAnimationFrame(update);

    if(reset) {
        things = [];
        playerStatus = {
            fuel: 0,
            life: 3,
            correctCount: 0,
            score: 0,
            pressing: { left: false, right: false },
            playing: true,
            god: false,
            speed: "normal",
            mode: 0
        }

        updateFuel();
        updateHearts();
        ModeDom.innerText = Modes[playerStatus.mode].name;
    }

    playAudio("ingame");
}

function gameOver() {
    document.getElementById("score").innerText = playerStatus.score;
    Screens.result.style.opacity = 1;
    Screens.result.style.pointerEvents = "all";

    pause(false);
    playAudio("result");
}

function tutorial() {
    Screens.tuto.style.pointerEvents = "all";
    Screens.tuto.style.opacity = 1;
}

function collisionAction(entity) {
    switch(entity.type) {
        case "bomb":
            if(playerStatus.god) return;
            gameOver();
            break;
        case "slime":
            playerStatus.god = true;
            setTimeout(() => { playerStatus.god = false; }, 5000);
            if(playerStatus.speed == "faster") playerStatus.speed = "normal";
            playAudio("gooditem", false);
            break;
        case "slower":
            playerStatus.speed = "slower";
            setTimeout(() => { playerStatus.speed = "normal"; }, 5000);
            playAudio("gooditem", false);
            break;
        case "faster":
            if(playerStatus.god) return;
            playerStatus.speed = "faster";
            setTimeout(() => { playerStatus.speed = "normal"; }, 5000);
            playAudio("baditem", false);
            break;
        case "solid":
            if(Modes[playerStatus.mode].material == 'S') {
                playerStatus.correctCount++;
                playerStatus.score++;
                if(playerStatus.correctCount % 2 == 0) addFuel(1);
                nextMode();
                playAudio("correct", false);
            }
            else if(!playerStatus.god) {
                addHP(-1);
                playAudio("wrong", false);
            }
            break;
        case "fluid":
            if(Modes[playerStatus.mode].material == 'F') {
                playerStatus.correctCount++;
                playerStatus.score++;
                if(playerStatus.correctCount % 2 == 0) addFuel(1);
                nextMode();
                playAudio("correct", false);
            }
            else if(!playerStatus.god) {
                addHP(-1);
                playAudio("wrong", false);
            }
            break;
        case "gas":
            if(Modes[playerStatus.mode].material == 'G') {
                playerStatus.correctCount++;
                playerStatus.score++;
                if(playerStatus.correctCount % 2 == 0) addFuel(1);
                nextMode();
                playAudio("correct", false);
            }
            else if(!playerStatus.god) {
                addHP(-1);
                playAudio("wrong", false);
            }
            break;
    }
}

class Entity {
    constructor(pos, vec, scl, img, type, physics = true) {
        this.pos = pos;
        this.vec = vec;
        this.scl = scl;
        this.rotate = 0;
        this.img = img;
        this.type = type;
        //this.img = new Image();
        //this.img.src = img;

        this.physics = physics; 
    }
    draw() {
        //ctx.fillStyle = this.img;
        //switch(this.type) {
        //    case "player":
        //        ctx.fillStyle = "#0000ff";
        //        break;
        //    case "bomb":
        //        ctx.fillStyle = "#000";
        //        break;
        //    case "slime":
        //        ctx.fillStyle = "blueviolet";
        //        break;
        //    case "slower":
        //        ctx.fillStyle = "green";
        //        break;
        //    case "faster":
        //        ctx.fillStyle = "red";
        //        break;
        //    case "solid":
        //        ctx.fillStyle = "darkmagenta";
        //        break;
        //    case "fluid":
        //        ctx.fillStyle = "aqua";
        //        break;
        //    case "gas":
        //        ctx.fillStyle = "gray";
        //        break;
        //}
        //ctx.fillRect(
        //    this.pos.x - this.scl.width / 2,
        //    this.pos.y - this.scl.height / 2,
        //    this.scl.width, this.scl.height
        //);
        ctx.drawImage(
            this.img,
            this.pos.x - this.scl.width / 2,
            this.pos.y - this.scl.height / 2,
            this.scl.width, this.scl.height
        );
    }
    addForce(vx, vy) {
        this.vec.x += vx;
        this.vec.y += vy;
    }
    setVector(v) {
        if(v.x !== undefined) this.vec.x = v.x;
        if(v.y !== undefined) this.vec.y = v.y;
    }
    friction(coe) {
        this.vec.x *= coe;
        this.vec.y *= coe;
    }
    move(framerate) {
        this.pos.x += this.vec.x / framerate;
        this.pos.y += this.vec.y / framerate;
        
        if(this.type == "player") {
            if(this.pos.x - this.scl.width / 2 < 50) this.pos.x = 50 + this.scl.width / 2;
            else if(this.pos.x + this.scl.width / 2 > WIDTH - 50) this.pos.x = WIDTH - 50 - this.scl.width / 2;
        }
    }
    screenOut() {
        if(this.pos.x + this.scl.width < 0 || this.pos.x - this.scl.width > WIDTH) return true;
        else if(this.pos.y + this.scl.height < 0 || this.pos.y - this.scl.height > HEIGHT) return true;
        return false;
    }
    detectCollision(other) {
        if(
            this.pos.x + this.scl.width / 2 > other.pos.x - other.scl.width / 2 &&
            other.pos.x + other.scl.width / 2 > this.pos.x - this.scl.width / 2 &&
            this.pos.y + this.scl.height / 2 > other.pos.y - other.scl.height / 2 &&
            other.pos.y + other.scl.height / 2 > this.pos.y - this.scl.height / 2
        ) return true;
        else return false;
    }
}
let entities = [];
let players = [];

window.addEventListener("resize", () => {
    let screenBounding = screenDom.getBoundingClientRect();
    canvas.width = screenBounding.width;
    canvas.height = screenBounding.height;
    WIDTH = canvas.width;
    HEIGHT = canvas.height;
    //ctx.imageSmoothingEnabled = false;
});

window.requestAnimationFrame(update);

function pause(show = true) {
    playerStatus.playing = false;
    if(show) {
        Screens.pause.style.opacity = 1;
        Screens.pause.style.pointerEvents = "all";
    }
}

function goMain() {
    Screens.main.style.opacity = 1;
    Screens.main.style.pointerEvents = "all";
    
    Screens.tuto.style.pointerEvents = "none";
    Screens.tuto.style.opacity = 0;

    playAudio("lobby");
}

function setup() {
    let screenBounding = screenDom.getBoundingClientRect();
    canvas.width = screenBounding.width;
    canvas.height = screenBounding.height;
    WIDTH = canvas.width;
    HEIGHT = canvas.height;

    players.push(
        new Entity(
            { x: WIDTH / 2, y: HEIGHT - 100 },
            { x: 0, y: 0 },
            { width: 50, height: 100 },
            Images.player,
            "player"
        )
    );
    
    //ctx.imageSmoothingEnabled = false;

    updateFuel();
    updateHearts();

    Buttons.pause.addEventListener("click", () => {
        pause();
    });

    const swiper = new Swiper(".swiper", {
        pagination: {
            el: '.swiper-pagination',
          },
    });

    setTimeout(() => { playAudio("lobby"); }, 1000);
}

function update(timestamp) {
    if(!start) start = timestamp;
    let progress = timestamp - start;
    let framerate = 1000 / (progress - preTimestamp);

    if(!playerStatus.playing) return;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    if(framerate > 5) draw(framerate);
    preTimestamp = progress;

    for(i in things) {
        if(things[i].screenOut()) {
            things.splice(i, 1);
            continue;
        }
        if(things[i].detectCollision(players[0])) {
            collisionAction(things[i]);
            things.splice(i, 1);
            continue;
        }
        if(playerStatus.speed == "faster") things[i].setVector({ y: 400 });
        else if(playerStatus.speed == "normal") things[i].setVector({ y: 200 });
        else if(playerStatus.speed == "slower") things[i].setVector({ y: 100 });
    }
    
    window.requestAnimationFrame(update);
}

function draw(framerate) {
    for(i in players) {
        players[i].move(framerate);
        players[i].draw();
    }
    for(i in things) {
        things[i].move(framerate);
        things[i].draw();
    }
}

function updatePlayerVector(pressStart = true) {
    if(playerStatus.pressing.left && !playerStatus.pressing.right) players[0].setVector({ x: -180 });
    else if(!playerStatus.pressing.left && playerStatus.pressing.right) players[0].setVector({ x: 180 });
    else if(!pressStart) players[0].setVector({ x: 0 });
}

window.addEventListener("keydown", evt => {
    if(evt.key == "ArrowLeft") playerStatus.pressing.left = true;
    if(evt.key == "ArrowRight") playerStatus.pressing.right = true;

    updatePlayerVector();
});

window.addEventListener("keyup", evt => {
    if(evt.key == "ArrowLeft") playerStatus.pressing.left = false;
    if(evt.key == "ArrowRight") playerStatus.pressing.right = false;

    updatePlayerVector(false);
});

Buttons.left.addEventListener("touchstart", () => {
    playerStatus.pressing.left = true;

    updatePlayerVector();
});

Buttons.left.addEventListener("mousedown", () => {
    playerStatus.pressing.left = true;

    updatePlayerVector();
});

Buttons.right.addEventListener("touchstart", () => {
    playerStatus.pressing.right = true;

    updatePlayerVector();
});

Buttons.right.addEventListener("mousedown", () => {
    playerStatus.pressing.right = true;

    updatePlayerVector();
});

Buttons.left.addEventListener("touchend", () => {
    playerStatus.pressing.left = false;

    updatePlayerVector(false);
});

Buttons.left.addEventListener("mouseup", () => {
    playerStatus.pressing.left = false;

    updatePlayerVector(false);
});

Buttons.right.addEventListener("touchend", () => {
    playerStatus.pressing.right = false;

    updatePlayerVector(false);
});

Buttons.right.addEventListener("mouseup", () => {
    playerStatus.pressing.right = false;

    updatePlayerVector(false);
});

let intervalTurn = 0;

setInterval(() => {
    if(!playerStatus.playing) return;
    
    intervalTurn++;
    if(
        playerStatus.speed == "normal" && intervalTurn > 1 ||
        playerStatus.speed == "faster" && intervalTurn > 0 ||
        playerStatus.speed == "slower" && intervalTurn > 3
    ) intervalTurn = 0;
    else return;

    let nowItem = ItemTypes[random(ItemTypes.length)];
    things.push(
        new Entity(
            { x: random(WIDTH - 200) + 100, y: 200 },
            { x: 0, y: 200 },
            { width: 50, height: 50 },
            nowItem.img,
            nowItem.name
        )
    )
}, 400);