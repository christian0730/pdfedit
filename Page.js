var PDFObject = require('./PDFObject')
var ENDL = process.env.ENDL || "\n"
var fontwidths = require('./fontWidths.js')

var Page = function(buffer){
	var self = new PDFObject(buffer)
	self.translateStack = [];
	self.textStream = ''
	self.font = ''
	self.fontSize = 0
	
	self.resetTranslate = function(){
		while(self.translateStack.length)
			self.endTranslate()
	}

	self.translate = function(x,y){
		self.writeln(x,y,'Td')
	}

	self.save = function(){
		self.writeln('q')
	}
	self.restore = function(){
		self.writeln('Q')
	}

	self.beginTranslate = function(x,y){
		self.save()
		self.translateStack.push([x,y])
		self.translate(x,y)
	}
	
	self.endTranslate = function(x,y){
		var pos = self.translateStack.pop()
		self.translate(-pos[0],-pos[1])
		self.restore()
	}

	self.write = function(){
		var text = Array.prototype.join.apply(arguments,[' '])
		self.textStream += text;
	}
	self.writeln = function(){
		var text = Array.prototype.join.apply(arguments,[' '])
		self.write(text + ENDL)
	}

	self.print = function(text,x,y){
		if(x || y)
			self.beginTranslate(x,y)
		self.writeln('('+text+')','Tj');
		if(x || y)
			self.endTranslate()
	}

	self.setFont = function(id,size){
		self.font = id
		self.fontSize = size
		self.writeln('/'+id,size,'Tf')
	}

	self.setStrokeColor = function(r,g,b){
		self.writeln(r.toFixed(1),g.toFixed(1),b.toFixed(1),'RG')
	}

	self.setFillColor = function(r,g,b){
		self.writeln(r.toFixed(1),g.toFixed(1),b.toFixed(1),'rg')
	}

	self.drawRect = function(x,y,w,h){
		self.writeln(x,y,w,h,'re h S')
	}

	self.drawFilledRect = function(x,y,w,h){
		self.writeln(x,y,w,h,'re h F')
	}

	self.drawFrame = function(x,y,w,title,text){
		var fs = 8//self.fontSize
		self.save()
		self.setStrokeColor(0,0,0)
		self.setFillColor(1,1,1)
		self.setFont('HelB',fs)
		w = w || self.calcWidth(text) + 10
		self.setFont('Hel',fs-1)
		var titleWidth = self.calcWidth(title)
		self.drawRect(x,y,w,fs + 5)
		self.drawFilledRect(x+5,y+fs+3,titleWidth+2,7)
		self.drawRect(x+5,y+fs+3,titleWidth+2,7)
		self.restore()
		self.save()
		self.setFont('Hel',fs-1)
		self.print(title,x+7,y+12)
		self.setFont('HelB',fs)
		var xoff = self.calcCenter(text,w)
		self.print(text,x+xoff,y+2)
		self.restore()
	}

	self.calcCenter = function(text,width){
		var w = self.calcWidth(text)
		return (width/2) - (w/2)
	}

	self.calcRight = function(text){
		var w = self.calcWidth(text)
		return -w
	}

	self.calcWidth = function(text){
		var fw = fontwidths[self.font=='Hel'?'helvetica':'helveticaBold']
		var w = 0;
		for(var i=0;i<text.length;i++)
			w += fw[text.charCodeAt(i)]
		w /= 1000
		w *= self.fontSize
		return w;
	}

	self.addObj = function(ref){
		self.metadata.Contents = self.metadata.Contents || []
		self.metadata.Contents.push(ref)
		self.imported = false
	}

	self.getTextObj = function(){
		var obj = new PDFObject()
		obj.setRaw('stream\r\nBT\r\n' + self.textStream + 'ET\r\nendstream')
		self.textStream = '';
		return obj;
	}

	return self
}

module.exports = Page