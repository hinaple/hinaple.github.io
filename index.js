const DOT_SIZE = 50;
const canvas = document.getElementById("cnvs");
const ctx = canvas.getContext('2d');
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
function display(arr, color) {
    reset();
    ctx.fillStyle = "black";
    for(var i = 0; i < 1000 / DOT_SIZE; i++) {
        for(var j = 0; j < 1000 / DOT_SIZE; j++) {
            if(arr[i][j] == 1) ctx.fillRectRect(i * DOT_SIZE, j * DOT_SIZE, DOT_SIZE, DOT_SIZE); 
            else ctx.strokeRect(i * DOT_SIZE, j * DOT_SIZE, DOT_SIZE, DOT_SIZE);
        }
    }
}
reset();
ctx.fillStyle = "black";
