var PDFObject = require('./PDFObject')
var ENDL = process.env.ENDL || "\n"
var fontwidths = require('./fontWidths.js')
var util = require('util')

var Page = function(buffer){
	Page.super_.call(this,buffer)
	var self = this;
	self.translateStack = [];
	self.textStream = ''
	self.font = ''
	self.fontSize = 0
	self.translatePos = {x:0, y:0};
}

util.inherits(Page,PDFObject)
	
Page.prototype.resetTranslate = function(){
	var self = this
	while(self.translateStack.length)
		self.endTranslate()
}

Page.prototype.translate = function(x,y){
	var self = this
	x = x.toFixed(0)
	y = y.toFixed(0)
	self.translatePos.x += parseInt(x);
	self.translatePos.y += parseInt(y);
	self.writeln(x,y,'Td')
}

Page.prototype.translateTo = function(x,y){
	var self = this
	var dx = x - self.translatePos.x
	var dy = y - self.translatePos.y
	self.translate(dx,dy)
}

Page.prototype.save = function(){
	var self = this
	self.translateStack.push(self.translatePos)
	self.translatePos = { x: self.translatePos.x, y: self.translatePos.y }
	self.writeln('q')
}

Page.prototype.restore = function(){
	var self = this
	self.writeln('Q')
	var pos = self.translateStack.pop()
	self.translatePos = pos
	//self.translateTo(pos.x,pos.y)
}

Page.prototype.beginTranslate = function(x,y){
	var self = this
	self.save()
	self.translate(x,y)
	//console.log('TRANSLATE','PUSH',x,y,self.translateStack)
}

Page.prototype.endTranslate = function(){
	var self = this
	//console.log('TRANSLATE','POP',self.translateStack)
	self.restore()
	//self.translateTo(self.translatePos.x,self.translatePos.y)
}

Page.prototype.write = function(){
	var self = this
	var text = Array.prototype.join.apply(arguments,[' '])
	self.textStream += text;
}
Page.prototype.writeln = function(){
	var self = this
	var text = Array.prototype.join.apply(arguments,[' '])
	self.write(text + ENDL)
}

Page.prototype.printLines = function(text,x,y){
	var self = this
	var spacing = self.fontSize + 2
	text = text.toString()
	text = text.replace("\r\n","\n")
	text = text.replace("\r","\n")
	var lines = text.split("\n")
	y -= lines.length * spacing
	for(var i=lines.length;i>=0;i--)	
	{
		self.print(lines[i],x,y);
		y += spacing
	}
}

Page.prototype.print = function(text,x,y){
	var self = this
	////console.log('PRINT',text,x,y)
	if(x || y)
		self.beginTranslate(x,y)
		//self.translateTo(x,y)
	self.writeln('('+text+')','Tj');
	if(x || y)
		self.endTranslate()
}

Page.prototype.setFont = function(id,size){
	var self = this
	self.font = id
	self.fontSize = size
	self.writeln('/'+id,size,'Tf')
}

Page.prototype.setStrokeColor = function(r,g,b){
	var self = this
	self.writeln(r.toFixed(1),g.toFixed(1),b.toFixed(1),'RG')
}

Page.prototype.setFillColor = function(r,g,b){
	var self = this
	self.writeln(r.toFixed(1),g.toFixed(1),b.toFixed(1),'rg')
}

Page.prototype.drawRect = function(x,y,w,h){
	var self = this
	//x += self.translatePos.x
	//y += self.translatePos.y
	self.writeln(x.toFixed(1),y.toFixed(1),w.toFixed(1),h.toFixed(1),'re h S')
}

Page.prototype.drawFilledRect = function(x,y,w,h){
	var self = this
	//x += self.translatePos.x
	//y += self.translatePos.y
	self.writeln(x,y,w,h,'re h F')
}

Page.prototype.setLineWidth = function(w){
	var self = this
	self.writeln(w,'w')
}

Page.prototype.drawFrame = function(x,y,w,title,text,mode){
	mode = mode || 3
	var self = this
	//console.log('drawFrame',x,y,w,title,text)
	var fs = 8//self.fontSize
	//console.log(self.translatePos)
	self.beginTranslate(x,y)
	var pos = self.translatePos;
	//console.log(self.translatePos)
	var titleWidth = self.calcWidth(title,'Hel',fs-1)
	
	if(mode & 1)
	{
		self.save()
			self.setStrokeColor(0,0,0)
			self.setFillColor(1,1,1)
			self.setLineWidth(0.5)
			self.drawRect(pos.x,pos.y,w,fs + 5)
			self.drawFilledRect(pos.x + 2,pos.y + fs + 3,titleWidth + 2,7)
			//self.drawRect(pos.x + 2,pos.y + fs + 3,titleWidth + 2,7)
		self.restore()
		self.setFont('Hel',fs-1)
		self.print(title,3,10)
	}
	if(mode & 2)
	{
	//console.log(self.translatePos,x,y)
		//self.save()
		self.setFont('HelB',fs)
		var xoff = self.calcCenter(text,w)
		self.print(text,xoff,2)
		//self.restore()
	}
	//self.translate(-x,-y)
	self.endTranslate()
}

Page.prototype.calcCenter = function(text,width){
	var self = this
	var w = self.calcWidth(text)
	return (width/2) - (w/2)
}

Page.prototype.calcRight = function(text){
	var self = this
	var w = self.calcWidth(text)
	return -w
}

Page.prototype.calcWidth = function(text,font,size){
	var self = this
	font = font || self.font
	size = size || self.fontSize
	var fw = fontwidths[font=='Hel'?'helvetica':'helveticaBold']
	var w = 0;
	for(var i=0;i<text.length;i++)
		w += fw[text.charCodeAt(i)]
	w /= 1000
	w *= size
	return w;
}

Page.prototype.addObj = function(ref){
	var self = this
	self.metadata.Contents = self.metadata.Contents || []
	self.metadata.Contents.push(ref)
	self.imported = false
}

Page.prototype.getTextObj = function(){
	var self = this
	var obj = new PDFObject()
	//obj.compress = true
	obj.setRaw(new Buffer('BT\r\n' + self.textStream + 'ET\r\n'))
	self.textStream = '';
	return obj;
}

module.exports = Page