let uuid = '', action = '', context = '';
/* 连接websoket $localizedStrings 国际化字符对象 */
$SD.on('connected', e => {
    uuid = e.uuid;
    action = e.actionInfo.action;
    context = e.actionInfo.context;
    localAll() // 自动国际化
})

/* 插件触发的事件 */
$SD.on('sendToPropertyInspector', e => {
    let { event, payload } = e
    /* 插件设置数据后触发 */
    if (event === 'didReceiveSettings') {
        let { title, content, time, color } = payload.settings
        $('#title').value = title || ''
        $('#time').value = time || ''
        $('#color').value = color || '#ff0000'
        $('#content').value = content || ''
        $('.sdpi-wrapper').style.display = 'block'
    }
})

/* 保存数据 */
function saveData() {
    $SD.api.setSettings(context, {
        time: $('#time').value,
        title: $('#title').value,
        color: $('#color').value,
        content: $('#content').value
    })
}

/* 提交数据 */
function submit() {
    let title = $('#title').value, content = $('#content').value,
        time = $('#time').value, color = $('#color').value
    if (!title || !content || !time) return;
    $SD.api.sendToPlugin(uuid, action, { title, time, color, content })
}

// $SD.api.sendToPlugin(uuid, action, {}) //传递负载给插件
// $SD.api.setSettings(context, {}) // 保存设置