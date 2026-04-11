import React, { useEffect, useRef } from 'react';

export const GlobalParticles = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let particles = [];
    let mouse = { x: -100, y: -100 };
    let frameCount = 0;

    const resize = () => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };

    class Particle {
      constructor(x, y, isExplosion = false) {
        this.x = x;
        this.y = y;
        this.isExplosion = isExplosion;
        
        if (isExplosion) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 6 + 2;
          this.vx = Math.cos(angle) * speed;
          this.vy = Math.sin(angle) * speed;
          this.life = 1;
          this.size = Math.random() * 2 + 2;
          this.color = Math.random() > 0.5 ? '#c084fc' : '#a78bfa';
        } else {
          this.vx = (Math.random() - 0.5) * 1.5;
          this.vy = (Math.random() - 0.5) * 1.5;
          this.life = 0.8;
          this.size = Math.random() * 1.5 + 0.5;
          this.color = 'rgba(167, 139, 250, 0.42)';
        }
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.isExplosion ? 0.025 : 0.015;
        if (this.isExplosion) {
          this.vy += 0.08; // Adjusted gravity
        }
      }

      draw() {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        // Use rect instead of arc for slight optimization if many particles
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frameCount++;
      
      // Throttled trail: only add on every 2nd frame
      if (mouse.x > 0 && frameCount % 2 === 0) {
        particles.push(new Particle(mouse.x, mouse.y));
      }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.update();
        p.draw();
        
        if (p.life <= 0) {
          particles.splice(i, 1);
          i--;
        }
      }
      
      // Strict particle limit for extreme speed
      if (particles.length > 150) {
        particles.shift();
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const handleTouchMove = (e) => {
      if (e.touches[0]) {
        mouse.x = e.touches[0].clientX;
        mouse.y = e.touches[0].clientY;
      }
    };

    const handleClick = (e) => {
      const x = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : -100);
      const y = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : -100);
      if (x > 0) {
        for (let i = 0; i < 16; i++) {
          particles.push(new Particle(x, y, true));
        }
      }
    };

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('mousedown', handleClick, { passive: true });
    window.addEventListener('touchstart', handleClick, { passive: true });

    resize();
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('touchstart', handleClick);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 99999,
        background: 'transparent'
      }}
    />
  );
};
