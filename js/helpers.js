function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)", "i"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

// ---- Game helpers (plain JS, no Paper.js) ----
function setStarOffset(x, y) {
    var far = (-x * 0.05 % 240) + 'px ' + (-y * 0.05 % 240) + 'px';
    var near = (-x * 0.15 % 330) + 'px ' + (-y * 0.15 % 330) + 'px';
    document.body.style.backgroundPosition = [far, far, far, near, near].join(',');
}
function loadBest() { try { return +localStorage.getItem('spacejam.best') || 0; } catch (e) { return 0; } }
function saveBest(v) { try { localStorage.setItem('spacejam.best', v); } catch (e) {} }
function updateHud(score, best, fuel) {
    document.getElementById('score').textContent = score;
    document.getElementById('best').textContent = best;
    document.getElementById('fuel').style.width = Math.max(0, fuel) + '%';
}
function showGameOver(on) {
    document.getElementById('over').hidden = !on;
    var flash = document.getElementById('flash');
    if (!on) { flash.style.opacity = 0; return; }
    var c = document.getElementById('myCanvas');
    c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake');
    flash.style.transition = 'none'; flash.style.opacity = 0.5;
    setTimeout(function() { flash.style.transition = ''; flash.style.opacity = 0; }, 30);
}
