let uuid = '', action = '', context = '';
/* 连接websoket $localizedStrings 国际化字符对象 */
$SD.on('connected', e => {
    uuid = e.uuid;
    action = e.actionInfo.action;
    context = e.actionInfo.context;
    localAll() // 自动国际化
})

/* 插件触发的事件 */
let nowList;
$SD.on('sendToPropertyInspector', e => {
    let { event, payload } = e
    /* 插件设置数据后触发 */
    if (event === 'didReceiveSettings') {
        let { title, content, list } = payload.settings
        nowList = list || []
        renderSelect()
        $('#title').value = title || ''
        $('#content').value = content || ''
        $('.sdpi-wrapper').style.display = 'block'
    }
})

/* 渲染快速查阅便签列表 */
function renderSelect(html = '') {
    if (nowList.length == 0) html += `<option>${localUI('暂无数据')}</option>`;
    else nowList.forEach(item => html += `<option>${item.title}</option>`);
    $('#myselect').innerHTML = html
}

/* 保存数据 */
function saveData() {
    $SD.api.setSettings(context, {
        list: nowList,
        title: $('#title').value,
        content: $('#content').value
    })
}

/* 提交数据 */
function submit() {
    let title = $('#title').value, content = $('#content').value
    if (!title || !content) return;
    nowList.unshift({ title, content, time: new Date().getTime() })
    $SD.api.sendToPlugin(uuid, action, { list: nowList })
    $('#title').value = $('#content').value = ''
    renderSelect()
    saveData()
}


// $SD.api.sendToPlugin(uuid, action, {}) //传递负载给插件
// $SD.api.setSettings(context, {}) // 保存设置