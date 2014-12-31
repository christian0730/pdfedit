
var deflate = require('zlib').deflate;
var ENDL = process.env.ENDL || "\n"
var dictionaryParser = require('./dictionaryParser.js')

function PDFObject(buffer){
	//PDFObject.super_.call(this)
	var self = this
	self.compress = false;
	self.metadata = {}
	self.imported = false;
	self.enabled = true;
	self.raw = null
	self.id = -1
	self.revision = -1
	if(buffer) self.parse(buffer);
}

PDFObject.prototype.getRef = function(){
	var self = this
	//return self.id+' '+self.revision+' R'
	return self.id+' 0 R'
}

PDFObject.prototype.setRaw = function(text){
	var self = this
	self.raw = text
	self.metadata.Length = self.raw.length
}

PDFObject.prototype.parse = function(buffer){
	var self = this
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
PDFObject.prototype.encode = function(call){
	call = call || noop
	var self = this
	if(self.raw)
		self.metadata.Length = self.raw.length
	var done = function(call){
		var bufs = [];
		if(self.compress)
		{
			self.metadata.Filter = '/FlateDecode'
			self.metadata.Length = self.rawCompressed.length || 0
		}
		if(self.raw)
			self.metadata.Length = self.raw.length || 0
		var emd = dictionaryParser.encode(self.metadata)
		bufs.push(new Buffer(self.id+' 0 obj'+ENDL))
		//ret += self.id+' '+self.revision+' obj'+ENDL
		bufs.push(new Buffer(emd+ENDL))
		if(self.raw)
		{
			if(self.rawCompressed)
				bufs.push(self.rawCompressed)
			else
				bufs.push(self.raw)
		}
		bufs.push(new Buffer(ENDL+"endobj"+ENDL))
		var ret = Buffer.concat(bufs);
		call(ret)
		return ret;
	}
	if(self.raw && self.compress)
	{
		deflate(self.raw,function(err,buf){
			buf = Buffer.concat([
				new Buffer('stream'+ENDL),
				buf,
				new Buffer(ENDL+'endstream')
			])
			self.rawCompressed = buf;
			done(call)
		})
	}else if(self.raw){
		if(typeof self.raw == 'string' && self.raw.trim()) 
			self.raw = new Buffer(self.raw)
		if(self.raw.toString().trim())
			self.raw = Buffer.concat([
				new Buffer('stream'+ENDL),
				self.raw,
				new Buffer(ENDL+'endstream')
			])
		return done(call)
	}else{
		return done(call)
	}
}

module.exports = PDFObject
function noop(){}