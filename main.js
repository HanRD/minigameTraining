let colorList=["#007700","#2244FF","#FF0000","#F20395"]
        let main_container = document.getElementById("container")
        const danmaku_container=document.getElementById("danmaku_container")
        const size = document.getElementById("size")
        const pointer = document.getElementById("mouse")
        const playerpos = document.getElementById("playerpos")
        const playerori = document.getElementById("playerori")
        const canvas = document.getElementById("canvas")
        const shooted = document.getElementById("shooted")
        const score_bar = document.getElementById("score")
        const context = canvas.getContext("2d")
        const fps = document.getElementById("frameIndicator")
        const MAX_MOB_COUNT=20
        let mainTimer = null
        let maxRange = Math.sqrt(Math.pow(canvas.width,2)+Math.pow(canvas.height,2))
        let weaponType = 1
        let homing = false
        let frame_timestamp_bucket=[]
        let bullet_shooted=0
        let bullet_bucket=[]
        let mobs_bucket=[]
        let danmaku_bucket=[]
        let idealFps = 60
        let currentFps =0
        let energy = 0
        let maxEnergy = 60
        let score=0
        let player = null
        let pressed = false
        let actionTimer = {
            move_f: null,
            move_b: null,
            rotate_p: null,
            rotate_n: null,
            shoot:null
        }
        let audioFiles=[
            "./source/blast.mp3",
            "./source/hit.mp3",
            "./source/shoot.mp3"
        ]
        class Danmaku{
            constructor(text,size=12,color="#FFFFFF",velocity=300){
                this.text=text
                this.size=size
                this.color=color
                this.velocity=velocity
                this.active=true
                this.body=null
                this.init()
            }
            init(){
                const dom = document.createElement("div")
                dom.innerHTML=this.text
                dom.className="danmaku"
                dom.style.color=this.color
                dom.style.fontSize=this.size
                dom.style.animationDuration=`${canvas.width/this.velocity}s`
                danmaku_container.append(dom)
                this.body=dom
                setTimeout(()=>{
                    this.active=false
                    this.destroy()
                },(canvas.width/this.velocity)*1000)
            }
            destroy(){
                if (this.body!=null) {
                    console.log(`已销毁弹幕${this.text},被销毁弹幕状态为${this.active?'正常':'失效'}`)
                    this.body.remove()
                }
            }
        }
        class vector2D {
            constructor(x, y) {
                this.x = x
                this.y = y
            }
            add(x, y) {
                this.x = this.x + x
                this.y = this.y + y
            }
            minus(x, y) {
                this.x = this.x - x
                this.y = this.y - y
            }
            set(x, y) {
                this.x = x
                this.y = y
            }
        }
        class Blaster{
            constructor(x, y,ori,velocity=10,color="#d7cc66"){
                this.pos = new vector2D(x, y)
                this.active = true;
                this.ori=ori;
                this.size=1;
                this.velocity=velocity;
                this.color=color;
                this.phase=1
                this.init()
                this.playSE()
            }
            init(){
                const timer=setInterval(()=>{
                    if (this.active) {
                        const view_angle = ((player.ori % (Math.PI * 2)) / (Math.PI * 2)) * 360
                        mobs_bucket.forEach((value,index)=>{
                            const mob_pos = Math.atan((this.pos.x-value.pos.x)/(this.pos.y-value.pos.y))
                            let mob_angle
                            if (this.pos.x<value.pos.x) {
                                if (this.pos.y>value.pos.y) {
                                    mob_angle=270-(mob_pos/(Math.PI*2)* 360)
                                }else{
                                    mob_angle=90-(mob_pos/(Math.PI*2)* 360)
                                }
                            }else{
                                if (this.pos.y>value.pos.y) {
                                    mob_angle=270-(mob_pos/(Math.PI*2)* 360)
                                }else{
                                    mob_angle=90-+(mob_pos/(Math.PI*2)* 360)
                                }
                            }
                            
                            const distance = calcDist(this.pos,value.pos)
                            const effectiveAngle = (Math.asin((value.size+this.size)/distance))/Math.PI*180
                            if (Math.abs(view_angle-mob_angle)<=effectiveAngle) {
                                //可以击中
                                value.takeDamage(500)
                            }
                        })
                        if (this.phase==1) {
                            this.size++
                            if (this.size==5) {
                                this.phase=0
                            }
                            
                        }else{
                            this.size--
                            if (this.size==1) {
                                this.active=false
                            }
                        } 
                    }else{
                        
                    }
                },1000/60)
            }
            draw(){
                drawRayCast(this.pos.x,this.pos.y,this.ori,maxRange,this.size*4,this.color)
            }
            playSE(){
                const aud = new Audio()
                aud.src="./source/blast.mp3"
                aud.play()
            }
        }
        class Bullet {
            constructor(x, y,ori,velocity,target,type=0,color="#d7cc66") {
                this.pos = new vector2D(x, y)
                this.active = true;
                this.ori=ori
                this.color=color;
                this.type=type
                this.size=type==0?5:100
                this.velocity=velocity
                this.bounceTimes=0
                if (type==1) {
                    
                }
                this.playSE()
                this.init()
            }
            init(){
                const timer=setInterval(()=>{
                    if (this.active) {
                        const inbound = this.pos.x>0-this.size&&this.pos.y>0-this.size&&this.pos.x<canvas.width+this.size&&this.pos.y<canvas.height+this.size
                        if (inbound) {
                            mobs_bucket.forEach((value,index)=>{
                                const distance = calcDist(this.pos,value.pos)
                                if (distance<value.size+this.size) {
                                    if (this.type==0) {
                                        value.takeDamage(100)
                                        this.active=false
                                    }else{
                                        value.takeDamage(500)
                                    }
                                    
                                }
                            })
                            this.pos.add(this.velocity * Math.cos(this.ori), this.velocity * Math.sin(this.ori))
                        }else{
                            if (this.bounceTimes<5) {
                                let baseval=0
                                if (this.pos.y<0-this.size||this.pos.y>canvas.height+this.size) {
                                    baseval=2*Math.PI
                                    console.log("Horizontal wall hit")
                                }
                                if(this.pos.x<0-this.size||this.pos.x>canvas.width+this.size){
                                    baseval=3*Math.PI
                                    console.log("Vertical wall hit")
                                }
                                this.ori=baseval-this.ori
                                this.velocity=this.velocity*1.3
                                this.bounceTimes++
                                this.pos.add(this.velocity * Math.cos(this.ori), this.velocity * Math.sin(this.ori))
                            }else{
                                clearInterval(timer);
                                this.active = false
                            }
                        }
                        }
                    
                },1000/60)
            }
            draw(){
                if (this.type==0) {
                        drawDot(this.pos.x, this.pos.y, 3, rgb(215, 171, 16))
                    }else{
                        drawDot(this.pos.x, this.pos.y, 103, "#FFFFFF")
                        drawDot(this.pos.x, this.pos.y, 100, rgb(215, 171, 16))
                    }
            }
            playSE(){
                const aud = new Audio()
                aud.src="./source/shoot.mp3"
                aud.play()
            }
        }
        class Mob{
            constructor(id,x,y,dynamic,health,size,bonus,color){
                this.id = id
                this.pos = new vector2D(x, y)
                this.dynamic = dynamic
                this.maxHealth=health
                this.health=health
                this.size=size
                this.bonus=bonus
                this.color=color
            }
            takeDamage(val=1){
                if (this.health>0) {
                    this.health=this.health-val
                    this.playSE()
                }else{
                    this.die()
                }
            }
            die(){
                console.log(`Killed a mob,score gained:${this.bonus}`)
                score=score+this.bonus;
                mobs_bucket.forEach((value,index)=>{
                    if (value.id==this.id) {
                        mobs_bucket.splice(index,1)
                    }
                })
                
            }
            playSE(){
                const aud = new Audio()
                aud.src="./source/hit.mp3"
                aud.play()
            }
        }
        class Player {
            constructor(x, y, distance = 100, fov = 45) {
                this.pos = new vector2D(x, y)
                this.ori = Math.PI *3/2
                this.distance = distance
                this.focus = new vector2D(x + (distance * Math.cos(this.ori)), y + (distance * Math.sin(this.ori)))
            }
            move(x, y) {
                this.pos.x = x
                this.pos.y = y
                this.updateFocus()
            }
            rotate(angle) {
                this.ori = this.ori + (Math.PI * angle / 180)
                this.updateFocus()
            }
            moveForward(distance) {
                this.pos.add(distance * Math.cos(this.ori), distance * Math.sin(this.ori))
                this.updateFocus()
            }
            updateFocus() {
                this.focus.set(this.pos.x + (this.distance * Math.cos(this.ori)), this.pos.y + (this.distance * Math.sin(this.ori)))
            }
            draw(){
                drawDot(this.pos.x, this.pos.y, 10, rgb(215, 171, 16))
                switch (weaponType) {
                    case 1:
                        drawCross(this.focus.x, this.focus.y, 5, rgb(215, 171, 16))
                        break;
                    case 2:
                        drawRayCast(this.pos.x, this.pos.y,this.ori- (Math.PI * 30 / 180),100,1,rgb(215, 171, 16))
                        drawRayCast(this.pos.x, this.pos.y,this.ori+ (Math.PI * 30 / 180),100,1,rgb(215, 171, 16))
                        break;
                    case 3:
                        drawRayCast(this.pos.x+10*Math.cos(this.ori+ (Math.PI/2)), this.pos.y+10*Math.sin(this.ori+ (Math.PI/2)),this.ori,100,1,rgb(215, 171, 16))
                        drawRayCast(this.pos.x-10*Math.cos(this.ori+ (Math.PI/2)), this.pos.y-10*Math.sin(this.ori+ (Math.PI/2)),this.ori,100,1,rgb(215, 171, 16))
                        drawRayCast(this.pos.x+90*Math.cos(this.ori), this.pos.y+90*Math.sin(this.ori),this.ori,15,1,rgb(215, 171, 16))
                        // drawArc(this.focus.x, this.focus.y,4,1 ,1, rgb(215, 171, 16))
                        drawArc(this.pos.x, this.pos.y,10,energy,maxEnergy,rgb(215, 171, 16))
                        break;
                    default:
                        break;
                }

            }
        }

        function init() {
            confInterface(main_container);
            registerCallback();
            spawnPlayer();
            initMobSpawner();
            spawnMob()
            initRenderTimer();
            // spawnDanmaku()
        }
        function preloadAudio(url) {
            var audio = new Audio();
            // once this file loads, it will call loadedAudio()
            // the file will be kept by the browser as cache
            audio.addEventListener('canplaythrough', loadedAudio, false);
            audio.src = url;
        }
        var loaded = 0;
        function loadedAudio() {
            // this will be called every time an audio file is loaded
            // we keep track of the loaded files vs the requested files
            loaded++;
            if (loaded == audioFiles.length){
            	// all have loaded
                init();
            }
        }
        function spawnDanmaku(){
            setInterval(()=>{
                if(danmaku_bucket.length<10){
                    const randomColor = rgb(Math.ceil(Math.random()*255),Math.ceil(Math.random()*255),Math.ceil(Math.random()*255))
                    const danmaku = new Danmaku(`测试用弹幕${Math.ceil(Math.random()*65536)}`,Math.ceil(6+Math.random()*12),randomColor,Math.ceil(50+Math.random()*100))
                    danmaku_bucket.push(danmaku)
                }else{
                    danmaku_bucket.forEach((value,index)=>{
                        if (value.active==false) {
                            danmaku_bucket.splice(index,1)
                        }
                    })
                }
            },1000)
        }
        
        function confWeapon(type){
            weaponType=type
            document.getElementById("rapid").className="btn"
            document.getElementById("spread").className="btn"
            document.getElementById("laser").className="btn"
            switch (type) {
                case 1:
                    document.getElementById("rapid").className="btn selected"
                    break;
                case 2:
                    document.getElementById("spread").className="btn selected"
                    break;
                case 3:
                    document.getElementById("laser").className="btn selected"
                    break;
                default:
                    break;
            }
            
        }
        function confHoming(){
            homing=!homing
            const indicator = document.getElementById("homing")
            if (homing) {
                indicator.className="btn selected"
            }else{
                indicator.className="btn"
            }
        }
        function calcDist(a,b){
            return Math.sqrt(Math.pow(a.x-b.x,2)+Math.pow(a.y-b.y,2))
        }
        function registerCallback() {
            window.onresize = (e) => {
                confInterface(main_container)
            }
            window.onkeydown = (e) => {
                //console.log(e.keyCode)
                switch (e.keyCode) {
                    case 65:
                        if (actionTimer.rotate_n == null) {
                            actionTimer.rotate_n = setInterval(() => {
                                player.rotate(-1)
                            }, 1)
                        }
                        break
                    case 68:
                        if (actionTimer.rotate_p == null) {
                            actionTimer.rotate_p = setInterval(() => {
                                player.rotate(1)
                            }, 1)
                        }
                        break
                    case 87:
                        if (actionTimer.move_f == null) {
                            actionTimer.move_f = setInterval(() => {
                                player.moveForward(1)
                            }, 1)
                        }
                        break
                    case 83:
                        if (actionTimer.move_b == null) {
                            actionTimer.move_b = setInterval(() => {
                                player.moveForward(-1)
                            }, 1)
                        }
                        break
                    case 32:
                        if (actionTimer.shoot ==null) {
                            let interval;
                            switch (weaponType) {
                                case 1:
                                    shoot(weaponType)
                                    interval=100
                                    break;
                                case 2:
                                    shoot(weaponType)
                                    interval=500
                                    break;
                                case 3:
                                    interval=1000/60
                                    break;
                                default:
                                    break;
                            }
                            actionTimer.shoot = setInterval(() => {
                                shoot(weaponType)
                            },interval)
                        }
                        break
                    default:
                        break
                }
            }
            window.onkeyup = (e) => {
                switch (e.keyCode) {
                    case 65:
                        if (actionTimer.rotate_n) {
                            clearInterval(actionTimer.rotate_n)
                            actionTimer.rotate_n = null
                        }
                        break
                    case 68:
                        if (actionTimer.rotate_p) {
                            clearInterval(actionTimer.rotate_p)
                            actionTimer.rotate_p = null
                        }
                        break
                    case 87:
                        if (actionTimer.move_f) {
                            clearInterval(actionTimer.move_f)
                            actionTimer.move_f = null
                        }
                        break
                    case 83:
                        if (actionTimer.move_b) {
                            clearInterval(actionTimer.move_b)
                            actionTimer.move_b = null
                        }
                        break
                    case 32:
                        if (actionTimer.shoot) {
                            
                            if (weaponType==3) {
                                if (energy==maxEnergy) {
                                    const blaster = new Blaster(player.pos.x,player.pos.y,player.ori)
                                    bullet_bucket.push(blaster)
                                    bullet_shooted++
                                    updateBulletCount()
                                }
                            }
                            energy=0
                            clearInterval(actionTimer.shoot)
                            actionTimer.shoot=null
                        }
                        break
                        default:
                            break
                }
            }
            canvas.onpointerdown = (e) => {
                console.log(e.type)
                pressed = true
            }
            canvas.ontouchstart = (e) => {
                pressed = true
            }
            canvas.onmousemove = (e) => {
                updatePointerPos([e.offsetX, e.offsetY])
                if (pressed) {
                    updatePlayerPos([e.offsetX, e.offsetY])
                }
            }
            canvas.ontouchc
            canvas.ontouchmove = (e) => {
                updatePointerPos([e.touches[0].clientX, e.touches[0].clientY])
                if (pressed) {
                    updatePlayerPos([e.touches[0].clientX, e.touches[0].clientY])
                }
            }
            canvas.ontouchend = canvas.onpointerout = canvas.onpointercancel = canvas.onpointerup = () => {
                pressed = false
            }
        }
        function shoot(type,target) {
            switch (type) {
                case 1:
                    const bullet = new Bullet(player.pos.x, player.pos.y,player.ori,10);
                    bullet_bucket.push(bullet)
                    bullet_shooted++
                    updateBulletCount()
                    break;
                case 2 :
                    let batch=[
                        new Bullet(player.pos.x, player.pos.y,player.ori- (Math.PI * 30 / 180),10),
                        new Bullet(player.pos.x, player.pos.y,player.ori- (Math.PI * 15 / 180),10),
                        new Bullet(player.pos.x, player.pos.y,player.ori,10),
                        new Bullet(player.pos.x, player.pos.y,player.ori+ (Math.PI * 15 / 180),10),
                        new Bullet(player.pos.x, player.pos.y,player.ori+ (Math.PI * 30 / 180),10),
                    ]
                    bullet_bucket=bullet_bucket.concat(batch)
                    bullet_shooted+=5
                    updateBulletCount()
                    break;
                case 3:
                    if (energy<maxEnergy) {
                        energy++
                    }else{
                        
                    }
                    break;
                default:
                    break;
            }
            
            const velocity =Math.random()*10
            
        }
        function initMobSpawner(){
            setInterval(spawnMob,3000)
        }
        function initRenderTimer(){
            window.requestAnimationFrame(renderGraph)
            
        }
        function renderGraph() {
            if (frame_timestamp_bucket.length<10) {
                    frame_timestamp_bucket.push(new Date().getTime())
                }else{
                    frame_timestamp_bucket.splice(0,1)
                    frame_timestamp_bucket.push(new Date().getTime())
            }
            updateCanvas()
            updateStateText()
            window.requestAnimationFrame(renderGraph)
        }
        //刷新宽高显示
        function confInterface(container) {
            updateSize([container.clientWidth, container.clientHeight])
        }
        //生成玩家object
        function spawnPlayer() {
            player = new Player(container.clientWidth / 2, (container.clientHeight / 2)*1.6)
        }
        
        function spawnMob(){
            if (mobs_bucket.length<10) {
                const pos = new vector2D(100+Math.random()*(canvas.width-100),100+Math.random()*(canvas.height-100))
                const health = Math.ceil(100+Math.random()*9900)
                const size = Math.ceil(health/100)
                const dist = calcDist(pos,player.pos)
                if (dist<150) {
                    spawnMob()
                }else{
                    const id = new Date().getTime()+Math.floor(Math.random()*100).toString()
                    const mob = new Mob(id,pos.x,pos.y,true,health,size,size,colorList[Math.floor(size/30)])
                    mobs_bucket.push(mob)
                }
            }
            
        }
        function updateCanvas() {
            context.clearRect(0, 0, container.clientWidth, container.clientHeight)
            player.draw()
            drawBullets()
            drawMobs()
        }
        function drawPlayer() {
            
        }
        function drawBullets() {
            for (let index = 0; index < bullet_bucket.length; index++) {
                const bullet = bullet_bucket[index];
                if (bullet.active) {
                    bullet.draw()
                    
                }else{
                    let bullet = bullet_bucket.splice(index, 1)
                    bullet=null
                }
            }
            
        }
        function drawMobs(){
            for (let index = 0; index < mobs_bucket.length; index++) {
                const mob = mobs_bucket[index]
                if (mob.health>0) {
                    drawMob(mob)
                    
                }else{
                    
                }
            }
        }
        function drawMob(mob){
            drawBody(mob)
            drawHealthBar(mob)
        }
        function drawBody(mob){
            drawDot(mob.pos.x, mob.pos.y,mob.size, mob.color)
        }
        
        function updateSize(argv) {
            canvas.width = argv[0]
            canvas.height = argv[1]
            maxRange = Math.sqrt(Math.pow(canvas.width,2)+Math.pow(canvas.height,2))
            size.innerHTML = `field size:${argv[0]}×${argv[1]}`
        }
        function updateBulletCount(){
            shooted.innerHTML =`shooted:${bullet_shooted}`
        }
        
        function updateStateText() {
            playerpos.innerHTML = `player:${Math.round(player.pos.x)},${Math.round(player.pos.y)}`
            const orientationText = Math.round(((player.ori % (Math.PI * 2)) / (Math.PI * 2)) * 360)
            playerori.innerHTML = `orientation:${orientationText}deg`
            if (frame_timestamp_bucket.length==10) {
                const fpsval =calcfps()
                fps.innerHTML=`fps:${fpsval}`
            }
            score_bar.innerHTML = `得分:${score}`
            //bulletpos.innerHTML =`bulletpos:${bullet_bucket[0].pos.x},${bullet_bucket[0].pos.y}`
        }
        function calcfps(){
            let diff=0
            for (let index = 1; index < frame_timestamp_bucket.length; index++) {
                diff+=frame_timestamp_bucket[index]-frame_timestamp_bucket[index-1]
            }
            return Math.floor(1000/(diff/9))
        }
        function updatePointerPos(argv) {
            pointer.innerHTML = `pointer:${argv[0]},${argv[1]}`
        }

        function updatePlayerPos(argv) {
            player.move(argv[0], argv[1])

        }
        
        function drawDot(x, y, r, color) {
            context.fillStyle = color
            context.beginPath()
            context.arc(x, y , r, 0, Math.PI * 2, false)
            context.fill()
        }
        function drawCross(x, y, r, color){
            context.strokeStyle = color
            context.beginPath()
            context.moveTo(x-r,y)
            context.lineTo(x+r,y)
            context.moveTo(x,y+r)
            context.lineTo(x,y-r)
            context.closePath()
            context.stroke()
        }
        function drawRayCast(x,y,angle,length,size, color) {
            context.strokeStyle = color
            context.lineWidth = size
            context.beginPath()
            context.moveTo(x,y)
            context.lineTo(x+length*Math.cos(angle),y+length*Math.sin(angle))
            context.stroke()
        }
        function drawHealthBar(mob){
            drawArc(mob.pos.x, mob.pos.y , mob.size,mob.health,mob.maxHealth,"#007700")
        }
        function drawArc(x,y,r,val,maxval,color){
            context.strokeStyle =color
            context.lineWidth = 1
            context.beginPath()
            context.arc(x, y , r+10, -Math.PI/2, -Math.PI * (2*val/maxval)-Math.PI/2, true)
            context.stroke()
        }
        function rgb(r, g, b) {
            return `#${r.toString(16)}${g.toString(16)}${b.toString(16)}`
        }

        for (var i in audioFiles) {
            preloadAudio(audioFiles[i]);
        }