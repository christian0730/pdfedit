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
		while(!~["\n","\r"].indexOf(buffer.slice(ind,ind+1).toString()))
			ind++
		metabuf = buffer.slice(m[0].length + 1,ind+1)
		self.metadata = dictionaryParser.parse(metabuf.toString())
		if(self.metadata.Length)
		{
			ind += 2
			self.raw = buffer.slice(ind,ind+self.metadata.Length);
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
}

module.exports = PDFObject
function noop(){}