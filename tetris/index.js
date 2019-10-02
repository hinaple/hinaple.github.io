const DOT_SIZE = 50;
const canvas = document.getElementById("cnvs");
const ctx = canvas.getContext('2d');

var map = [];
var back = [];
for(var i = 0; i < 1000 / DOT_SIZE; i++) {
    map.push([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    back.push([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
}
map[10][0] = 1;
map[10][1] = 1;
map[10][2] = 1;
map[10][3] = 1;
//back[10][7] = 1;
function reset() {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 1000, 1000);
    ctx.strokeStyle = "black";
    for(var i = 0; i < 1000 / DOT_SIZE; i++) {
        for(var j = 0; j < 1000 / DOT_SIZE; j++) {
            ctx.strokeRect(i * DOT_SIZE, j * DOT_SIZE, DOT_SIZE, DOT_SIZE);
        }
    }
}
function display(color) {
    reset();
    ctx.fillStyle = "black";
    for(var i = 0; i < 1000 / DOT_SIZE; i++) {
        for(var j = 0; j < 1000 / DOT_SIZE; j++) {
            if(map[j][i] == 1) ctx.fillRect(j * DOT_SIZE, i * DOT_SIZE, DOT_SIZE, DOT_SIZE); 
            else ctx.strokeRect(j * DOT_SIZE, i * DOT_SIZE, DOT_SIZE, DOT_SIZE);
            if(back[j][i] == 1) {
                ctx.fillStyle = "gray";
                ctx.fillRect(j * DOT_SIZE, i * DOT_SIZE, DOT_SIZE, DOT_SIZE); 
                ctx.fillStyle = "black";
            }
        }
    }
}
function gravity() {
    for(var i = (1000 / DOT_SIZE) - 1; i >= 0; i--) {
        for(var j = (1000 / DOT_SIZE) - 1; j >= 0; j--) {
            if(map[j][i] == 1) {
                if(i + 1 < 1000 / DOT_SIZE && back[j][i + 1] == 0) {
                   map[j][i + 1] = 1;
                   map[j][i] = 0;
                }
                else {
                    map[j][i] = 0;
                    back[j][i] = 1;
                };
            }
        }
    }
}
window.onkeydown = function() {

}
window.onkeyup = function() {
    
}

display();
ctx.fillStyle = "black";

setInterval(function() {
    gravity();
    display();
}, 500);