function getRandomWithSeed(argSeed) {
   var seed = argSeed;
   return function () {
    var lo = 16807 * (seed & 0xFFFF);
    var hi = 16807 * (seed >> 16);
    
    lo += (hi & 0x7FFF) << 16;
    lo += hi >> 15;
    
    if (lo < 0x7FFFFFFF) {
        lo -= 0x7FFFFFFF;
    }

    lo = Math.abs(lo);
    
    seed = lo;
    
    var result = seed / 0xAFFFFFFF;
	
	return result;
  }
}

function getXorRandomWithSeed(argSeed) {
   var xorSeed = argSeed;
   return function () {
    xorSeed = xorSeed ^ (xorSeed >> 12) // a
    xorSeed = xorSeed ^ (xorSeed << 25) // b
    xorSeed = xorSeed ^ (xorSeed >> 27) // c
    return ((xorSeed * 2685821657736338717) % 1000) / 1000;
  }
}

