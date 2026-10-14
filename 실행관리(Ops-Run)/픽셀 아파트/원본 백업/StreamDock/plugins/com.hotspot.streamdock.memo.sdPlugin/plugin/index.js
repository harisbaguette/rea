window.addEventListener('storage', function (e) {
    $data["com.hotspot.streamdock.memo.action1"].storageChange(e.key, e.newValue)
})

/* 行动数据汇总 */
let language, $data = {
    /* 实用便签 */
    "com.hotspot.streamdock.memo.action1": {
        context_pool: {},
        windowRef: null, // 存储当前弹框的引用
        keyUp(data) {
            let { context, payload } = data
            let { list } = payload.settings
            this.context_pool[context] = payload.settings
            
            // 检查当前是否有弹框打开
            if (this.windowRef && !this.windowRef.closed) {
                // 如果有弹框且未关闭，则关闭它
                this.windowRef.close()
                this.windowRef = null
            } else {
                // 如果没有弹框或已关闭，则打开新弹框
                let img = new Image();
                img.src = './memo.html'
                this.windowRef = window.open(`${img.src}?params=` + encodeURI(JSON.stringify({
                    list, language, context
                })))
            }
        },
        /* 删除便签 */
        storageChange(context, lsvalue) {
            value=JSON.parse(lsvalue)
            let data = this.context_pool[context]
            if(value.isdel){
                let tranfertime=value.time;
                let index = data.list.findIndex(item => item.time == tranfertime)
                data.list.splice(index, 1)
                
            }else{
                if(data.list==undefined){
                    data.list=[]
                }
                if(value.time>=data.list.length){
                    data.list.push(value.data)
                }else{
                    data.list[value.time]=value.data;
                }
                
            }
            $SD.setSettings(context, { list: data.list })
        },
        sendToPlugin(data) {
            data.payload.settings = data.payload
            this.keyUp(data)
        },
        willAppear(data) {
            localStorage.clear()
            let { context } = data
            this.context_pool[context] = this.context_pool[context] || {}
        }
    },
    /* 记录待办 */
    "com.hotspot.streamdock.memo.action2": {
        context_pool: {},
        windowRef: null, // 存储当前弹框的引用
        /* 主函数 */
        main(data, willAppear = false) {
            let { context } = data
            let { title, content, time, color } = data.payload.settings || data.payload

            /* 首次创建不打开详情 */
            if (!willAppear) {
                let img = new Image(), params; img.src = './todo.html'
                params = JSON.stringify({ title, content, time, language })
                this.windowRef = window.open(`${img.src}?params=` + encodeURI(params));
            }

            /* 开始倒计时 没有参数则不执行 */
            if (!title || !content || !time) return;
            const countdown = () => {
                let DValue = new Date(time).getTime() - new Date().getTime()
                this.context_pool[context].outTimer?.stop()
                /* 倒计时结束闪烁背景 */
                if (DValue < 0) {
                    let check = false, checkFunc = () => {
                        check = !check
                        $SD.setTitle(context, 'Time out')
                        if (check) $SD.setBG(context, color)
                        else $SD.setImage(context, '../static/img/check.png');
                    }
                    this.context_pool[context].timer?.stop()
                    this.context_pool[context].outTimer = new Timer(checkFunc, 2000, true)
                }
                else {
                    let s = parseInt(DValue / 1000)
                    let m = parseInt(s / 60)
                    let h = parseInt(m / 60)
                    $SD.setImage(context, '../static/img/check.png')
                    $SD.setTitle(context, `${$.split(title, 2)}\n${$(h)}:${$(m % 60)}:${$(s % 60)}`)
                }
            }
            this.context_pool[context].timer?.stop()
            this.context_pool[context].timer = new Timer(countdown, 1000, true)
        },
        sendToPlugin(data) {
            this.main(data)
        },
        keyUp(data) {
            // 检查当前是否有弹框打开
            if (this.windowRef && !this.windowRef.closed) {
                // 如果有弹框且未关闭，则关闭它
                this.windowRef.close()
                this.windowRef = null
            } else {
                // 如果没有弹框或已关闭，则打开新弹框
                this.main(data)
            }
        },
        willAppear(data) {
            /* 没有数据则创建新数据 */
            let { context } = data
            if (!this.context_pool[context]) this.context_pool[context] = {}
            this.main(data, true)
        },
        willDisappear(data) {
            let { context } = data
            this.context_pool[context].timer?.stop()
            this.context_pool[context].outTimer?.stop()
        }
    }
}

/* 注册插件 */
async function connectElgatoStreamDeckSocket(inPort, inPluginUUID, inRegisterEvent, inInfo) {

    /* 获取国际化字符串 */
    // let localizedStrings = await $.localizedStrings(JSON.parse(inInfo).application.language)
    websocket = new WebSocket("ws://127.0.0.1:" + inPort);
    websocket.onopen = () => websocket.send(JSON.stringify({
        event: inRegisterEvent, uuid: inPluginUUID
    }))
    /* 模块化监听 */
    websocket.onmessage = function (e) {
        let data = JSON.parse(e.data), { event, action } = data;
        language = JSON.parse(inInfo).application.language
        $data[action]?.[event]?.(data)
    }
}