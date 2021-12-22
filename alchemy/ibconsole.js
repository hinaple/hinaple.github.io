class IBConsole {
    constructor(options = {}) {
        function createClassedEl(tag, className) {
            let el = document.createElement(tag);
            el.className = className;
            return el;
        }
        
        this.opened = false;
        this.size = options.size || 300;
        this.autoScroll = !options.autoScroll;
        
        let openKey = options.openKey || "F12";
        
        this.element = document.createElement("div");
        this.element.className = "ib-console";

        let contentsBox = createClassedEl("div", "contents");

        this.consoleBox = createClassedEl("div", "console-box");
        contentsBox.append(this.consoleBox);

        this.element.append(contentsBox);

        document.body.append(this.element);
        this.element.style.right = `${-this.size}px`;
        this.element.style.width = `${this.size}px`;

        document.addEventListener("keydown", evt => {
            if(evt.key == openKey) {
                this.toggle();
            }
        });

        if(!options.dontCatchErr) {
            window.onerror = (evt, url, line, column) => {
                const lineInfo = `${url}:${line}:${column}`;
                if(options.errorAlert) {
                    alert(`An error occurred at "${lineInfo}".\nCheck it in the console with pressing ${openKey}.`);
                }
                this.log(evt, "error", lineInfo);
            }
        }
    }
    _getErrObj() {
        try {
            throw Error();
        }
        catch(error) {
            return error;
        }
    }
    _getLineNum() {
        let str = this._getErrObj().stack.split("\n")[4];
        return str.replace(/\s*at\s/, '');
    }
    toggle() {
        if(!this.opened) this.open();
        else this.close();
    }
    open() {
        this.opened = true;
        this.element.style.right = `0px`;
    }
    close() {
        this.opened = false;
        this.element.style.right = `${-this.size}px`;
    }
    log(msg, type = '', line = this._getLineNum()) {
        let isItOnTop = false;
        if(this.consoleBox.scrollTop + this.consoleBox.offsetHeight + 20 > this.consoleBox.scrollHeight) isItOnTop = true;
        let logEl = document.createElement("div");
        logEl.className = `log ${type}`;
        logEl.innerText = msg;
        let lineEl = document.createElement("div");
        lineEl.className = "line";
        lineEl.innerText = line;

        this.consoleBox.append(logEl, lineEl);

        if(isItOnTop) this.consoleBox.scrollTop = this.consoleBox.scrollHeight;
    }
    error(msg, line = this._getLineNum()) { this.log(msg, "error", line); }

    isOpened() { return this.opened; }
}

const ibc = new IBConsole({
    size: 500,
    openKey: "F9"
});