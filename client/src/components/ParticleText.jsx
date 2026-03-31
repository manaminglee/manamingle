import React, { useEffect, useRef } from 'react';

export const ParticleText = ({ text = "MANA MINGLE", className = "" }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let animationFrameId;

    let particles = [];
    const mouse = { x: 0, y: 0, radius: 150 };

    const init = () => {
      canvas.width = window.innerWidth;
      canvas.height = 300;
      particles = [];

      // Draw text to get pixel data
      ctx.fillStyle = 'white';
      ctx.font = '900 70px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let y = 0, y2 = imageData.height; y < y2; y += 3) {
        for (let x = 0, x2 = imageData.width; x < x2; x += 3) {
          if (imageData.data[(y * 4 * imageData.width) + (x * 4) + 3] > 128) {
            let positionX = x;
            let positionY = y;
            particles.push(new Particle(positionX, positionY));
          }
        }
      }
    };

    class Particle {
      constructor(x, y) {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.destX = x;
        this.destY = y;
        this.size = 1.2;
        this.baseX = this.x;
        this.baseY = this.y;
        this.density = (Math.random() * 40) + 5;
        this.color = '#06b6d4';
      }

      draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
      }

      update() {
        let dx = mouse.x - this.x;
        let dy = mouse.y - this.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        let forceDirectionX = dx / distance;
        let forceDirectionY = dy / distance;
        let maxDistance = mouse.radius;
        let force = (maxDistance - distance) / maxDistance;
        let directionX = forceDirectionX * force * this.density;
        let directionY = forceDirectionY * force * this.density;

        if (distance < mouse.radius) {
          this.x -= directionX;
          this.y -= directionY;
          this.color = 'white';
        } else {
          if (this.x !== this.destX) {
            let dx = this.x - this.destX;
            this.x -= dx / 15;
          }
          if (this.y !== this.destY) {
            let dy = this.y - this.destY;
            this.y -= dy / 15;
          }
          this.color = '#06b6d4';
        }
        
        // Subtle idle animation
        this.x += Math.sin(Date.now() / 1000 + this.destX) * 0.1;
        this.y += Math.cos(Date.now() / 1000 + this.destY) * 0.1;
      }
    }

    const drawCore = () => {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Proximity glow
      const dx = mouse.x - centerX;
      const dy = mouse.y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const proximityScale = Math.max(0, 1 - dist / 300);
      
      const pulse = Math.sin(Date.now() / 600) * 5;
      const radius = 35 + pulse + (proximityScale * 15);
      
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      gradient.addColorStop(0, `rgba(6, 182, 212, ${0.4 + proximityScale * 0.4})`);
      gradient.addColorStop(0.5, `rgba(99, 102, 241, ${0.1 + proximityScale * 0.2})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 2, 0, Math.PI * 2);
      ctx.fill();

      // Outer ring
      ctx.strokeStyle = `rgba(6, 182, 212, ${0.1 + proximityScale * 0.3})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 10, 0, Math.PI * 2);
      ctx.stroke();
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawCore();
      for (let i = 0; i < particles.length; i++) {
        particles[i].draw();
        particles[i].update();
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    const handleMouseMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = event.clientX - rect.left;
      mouse.y = event.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    window.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('resize', init);

    init();
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('resize', init);
    };
  }, [text]);

  return (
    <div className={`relative w-full h-[300px] flex items-center justify-center overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        className="cursor-default w-full h-full"
      />
    </div>
  );
};
