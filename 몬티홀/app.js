let n = 100;
let delay = 0;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let result = {
    success: 0,
    fail: 0
};

let doors = [];
for(let i = 0; i < 3; i++) doors[i] = document.getElementById('d' + i);
let resdoc = [ document.getElementById("succ"), document.getElementById("fail") ];
let timdoc = document.getElementById("time");
let deldoc = document.getElementById("delay");
let startbtn = document.getElementById("startbtn");

startbtn.addEventListener("click" , async () => {
    startbtn.disabled = true;
    if(timdoc.value == '') timdoc.value = 100;
    if(deldoc.value == '') deldoc.value = 0;
    n = Number(timdoc.value);
    delay = Number(deldoc.value);
    result = {
        success: 0,
        fail: 0
    };
    for(let i = 0; i < n; i++) {
        for(let j = 0; j < 3; j++) doors[j].style.backgroundColor = "#fff";
        let car = Math.floor(Math.random() * 3);
        for(let j = 0; j < 3; j++) {
            if(j == car) doors[j].innerHTML = '차';
            else doors[j].innerHTML = "염소";
        }
        let sel = Math.floor(Math.random() * 3);
        doors[sel].style.backgroundColor = "aqua";
        let after = false;
        let opened = false;
        for(;;) {
            opened = Math.floor(Math.random() * 3);
            if(opened == car || opened == sel) continue;
            else break;
        }
        for(;;) {
            after = Math.floor(Math.random() * 3);
            if(after == opened) continue;
            else break;
        }
        doors[after].style.backgroundColor = "blue";
        let successed = false;
        if((sel == after && car == after) || (sel != after && car != after)) successed = false;
        else successed = true;
        result[successed? "success": "fail"]++;

        resdoc[0].innerHTML = result.success;
        resdoc[1].innerHTML = result.fail;
        console.log("================\n" + i + "번째\n자동차의 위치: " + car + "\n처음 선택한 위치: " + sel + "\n선택을 바꾼 후의 위치: " + after + "\n몬티홀의 성공 여부: " + successed);

        await sleep(delay);
    }
    alert("역설이 맞았네: " + result.success + "\n역설이 틀렸네: " + result.fail + "\n맞았네 : 틀렸네 = " + result.success / (result.success + result.fail) * 100 + "% : " + result.fail / (result.success + result.fail) * 100 + "%")
    startbtn.disabled = false;
})