const DOT_SIZE = 50;
const canvas = document.getElementById("cnvs");
const ctx = canvas.getContext('2d');
const WIDTH = 500;
const HEIGHT = 800;

var map = [];
var back = [];
for(var i = 0; i < HEIGHT / DOT_SIZE; i++) {
    map.push([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    back.push([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
}
map[1][0] = 1;
map[2][0] = 1;
back[15][1] = 1;
back[15][2] = 1;
back[15][3] = 1;
back[15][4] = 1;
back[15][5] = 1;
back[15][6] = 1;
back[15][7] = 1;
back[15][8] = 1;
back[15][9] = 1;
back[14][1] = 1;
back[14][2] = 1;
back[14][3] = 1;
back[14][4] = 1;
back[14][5] = 1;
back[14][6] = 1;
back[14][7] = 1;
back[14][8] = 1;
back[14][9] = 1;

function reset() {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.strokeStyle = "black";
}
function display(color) {
    reset();
    ctx.fillStyle = "#000000";
    for(var i = 0; i < HEIGHT / DOT_SIZE; i++) {
        for(var j = 0; j < WIDTH / DOT_SIZE; j++) {
            if(map[i][j] == 1) ctx.fillRect(j * DOT_SIZE, i * DOT_SIZE, DOT_SIZE, DOT_SIZE); 
            else ctx.strokeRect(j * DOT_SIZE, i * DOT_SIZE, DOT_SIZE, DOT_SIZE);
            if(back[i][j] == 1) {
                ctx.fillStyle = "gray";
                ctx.fillRect(j * DOT_SIZE, i * DOT_SIZE, DOT_SIZE, DOT_SIZE); 
                ctx.fillStyle = "black";
            }
        }
    }
}
function gravity() {
    for(var i = (HEIGHT / DOT_SIZE) - 1; i >= 0; i--) {
        for(var j = (WIDTH / DOT_SIZE) - 1; j >= 0; j--) {
            if(map[i][j] == 1) {
                if(i + 1 < HEIGHT / DOT_SIZE && back[i + 1][j] == 0) {
                    map[i + 1][j] = 1;
                    map[i][j] = 0;
                }
                else {
                    map[i][j] = 0;
                    back[i][j] = 1;
                }
            }
        }
    }
    check();
}
function check() {
    for(var i = (HEIGHT / DOT_SIZE) - 1; i >= 0; i--) {
        for(var j = 0; j < WIDTH / DOT_SIZE; j++) {
            if(back[i][j] != 1) break;
            else if(j + 1 == WIDTH / DOT_SIZE) {
                back[i] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
                for(var k = i; k >= 0; k--) {
                    back[k + 1] = back[k];
                    back[k] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
                }
                break;
            }
        }
    }
}
/*function backGrav() {
    for(var i = (HEIGHT / DOT_SIZE) - 1; i >= 0; i--) {
        for(var j = (WIDTH / DOT_SIZE) - 1; j >= 1; j--) {
            if(back[i][j] != 0) break;
            else if(j == 0) {
                for(var k = 0; k < (WIDTH / DOT_SIZE) - 1; k++) {
                    for(var l = i; l >= 0; l--) back[l][k] = back[l][k - 1];
                }
            }
        }
    }
}*/

window.onkeydown = function() {

}
window.onkeyup = function() {
    
}

display();
ctx.fillStyle = "black";

setInterval(function() {
    gravity();
    display();
    //backGrav();
}, 500);