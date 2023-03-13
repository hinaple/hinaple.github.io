const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let player = {
    pos: [300, 700],
    prvPos: [300, 700],
    vel: [0, 0],
};

let plates = [
    {
        pos: [400, 800],
        length: 800,
        collision: false,
    },
    {
        pos: [500, 600],
        length: 200,
        collision: false,
    },
    {
        pos: [350, 300],
        length: 200,
        collision: false,
    },
];

const ChoonImg = new Image();
ChoonImg.src = "./choonsik.png";

let isChoonsikOnGround = false;
let jumpCount = 0;

function draw() {
    ctx.clearRect(0, 0, 800, 800);

    //save previous position
    player.prvPos[0] = player.pos[0];
    player.prvPos[1] = player.pos[1];

    player.pos[0] += player.vel[0];
    player.pos[1] += player.vel[1];

    if (pressing.ArrowLeft) player.vel[0] -= 1.5;
    if (pressing.ArrowRight) player.vel[0] += 1.5;
    if (pressing.ArrowDown) player.pos[1] += 5;

    //detect wall collision
    if (player.pos[0] - 40 < 0) {
        player.vel[0] *= -1;
        player.pos[0] = 40;
    }
    if (player.pos[0] + 40 >= 800) {
        player.pos[0] = 760;
        player.vel[0] *= -1;
    }

    for (const plate of plates) {
        if (
            player.pos[0] + 40 > plate.pos[0] - plate.length / 2 &&
            player.pos[0] - 40 < plate.pos[0] + plate.length / 2 &&
            player.prvPos[1] + 40 <= plate.pos[1] &&
            player.pos[1] + 40 > plate.pos[1] &&
            player.pos[1] - 40 < plate.pos[1] + 30 &&
            player.vel[1] > 0
        ) {
            isChoonsikOnGround = true;
            jumpCount = 0;
            player.pos[1] = plate.pos[1] - 40;
            player.vel[1] *= -0.3;
            plate.collision = true;
            break;
        } else {
            plate.collision = false;
            isChoonsikOnGround = false;
        }
    }

    player.vel[1] += 0.7;

    player.vel[0] *= 0.9;
    player.vel[1] *= 0.98;

    for (const plate of plates) {
        if (plate.collision) ctx.fillStyle = "red";
        else ctx.fillStyle = "#000";
        ctx.fillRect(
            plate.pos[0] - plate.length / 2,
            plate.pos[1],
            plate.length,
            30
        );
    }

    ctx.drawImage(ChoonImg, player.pos[0] - 40, player.pos[1] - 40, 80, 80);
}

setInterval(draw, 15);

let pressing = {};
document.body.addEventListener("keydown", (evt) => {
    pressing[evt.key] = true;
    if ((isChoonsikOnGround || jumpCount < 1) && evt.key === "ArrowUp") {
        player.vel[1] = -20;
        if (!isChoonsikOnGround) jumpCount++;
    }
});

document.body.addEventListener("keyup", (evt) => {
    pressing[evt.key] = false;
});
