var ENDL = process.env.ENDL || "\n"
var dictionaryParser = require('./dictionaryParser.js')

function PDFObject(buffer){
	var self = this
	self.metadata = {}
	self.imported = false;
	self.enabled = true;
	self.raw = null

	self.init = function(){
		if(buffer) self.parse(buffer);
	}

	self.getRef = function(){
		return self.id+' '+self.revision+' R'
	}

	self.setRaw = function(text){
		self.raw = text
		self.metadata.Length = self.raw.length
	}

	self.parse = function(buffer){
		self.imported = true;
		var head = buffer.slice(0,1024).toString();
		var m = head.match(/^([0-9]+)[ ]+([0-9]+)[ ]+obj/)
		//console.log(head,m)
		self.id = m[1]
		self.revision = m[2]
		var ind = m[0].length + 1;
		//while(!~["\n","\r"].indexOf(buffer.slice(ind,ind+1).toString()))
		//	ind++
		if(buffer.slice(ind,ind+8).toString().match(/\<|\[|\(/))
		{	
			ind = dictionaryParser.scanForEnd(buffer,m[0].length + 1)
			metabuf = buffer.slice(m[0].length + 1,ind)
			console.log(buffer.length)
			self.metadata = dictionaryParser.parse(metabuf)
		}
		var start = ind;
		while(buffer.slice(ind,ind+6) != 'endobj' && ind < buffer.length)
			ind++
		//if()//self.metadata.Length)
		{
			start += 2
			if(self.metadata && self.metadata.Length)
				self.raw = buffer.slice(start,start+self.metadata.Length);
			else
				self.raw = buffer.slice(start,ind);
		}
		

		//console.log(self.metadata,self.raw)
	}
	self.encode = function(){
		var emd = dictionaryParser.encode(self.metadata)
		var ret = '';
		ret += self.id+' 0 obj'+ENDL
		//ret += self.id+' '+self.revision+' obj'+ENDL
		ret += emd+ENDL
		if(self.raw)
			ret += self.raw+ENDL
		ret += "endobj"+ENDL
		return ret;
	}
	self.init()
	return self
}

module.exports = PDFObject
function noop(){}