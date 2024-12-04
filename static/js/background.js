// static/js/background.js

document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('background-canvas');
    const ctx = canvas.getContext('2d');
    let width, height;
    let nodes = [];
    let targetNodeCount;
    const mouse = { x: undefined, y: undefined, radius: 100 };

    function resizeCanvas() {
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight;
        
        // Calculate scale factors
        const scaleX = newWidth / width;
        const scaleY = newHeight / height;

        width = newWidth;
        height = newHeight;
        canvas.width = width;
        canvas.height = height;
        
        // Adjust number of nodes based on screen size
        targetNodeCount = Math.floor((width * height) / 20000); //reduce number of nodes, divide by big number =reduce nodes. divide by small number, add nodes.

        // Adjust existing node positions
        nodes.forEach(node => {
            node.x *= scaleX;
            node.y *= scaleY;
        });
    }

    function createNode() {
        return {
            x: Math.random() * width,
            y: Math.random() * height,
            radius: Math.random() * 2 + 1,
            vx: Math.random() * 0.5 - 0.25,
            vy: Math.random() * 0.5 - 0.25
        };
    }

    function adjustNodeCount() {
        const difference = targetNodeCount - nodes.length;
        if (difference > 0) {
            // Add nodes
            for (let i = 0; i < difference; i++) {
                nodes.push(createNode());
            }
        } else if (difference < 0) {
            // Remove nodes
            nodes.splice(targetNodeCount, -difference);
        }
    }

    function drawNode(node) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(100, 900, 10, 0.5)'; //color, i just randomly put 900 and 10, got green, and it suited the project. very cool.
        ctx.fill();
    }

    function drawEdge(node1, node2) {
        ctx.beginPath();
        ctx.moveTo(node1.x, node1.y);
        ctx.lineTo(node2.x, node2.y);
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.1)';
        ctx.stroke();
    }

    function updateNodes() {
        adjustNodeCount();

        nodes.forEach(node => {
            if (mouse.x !== undefined && mouse.y !== undefined) {
                let dx = mouse.x - node.x;
                let dy = mouse.y - node.y;
                let distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < mouse.radius) {
                    let force = (mouse.radius - distance) / mouse.radius;
                    node.vx -= dx * force * 0.02;
                    node.vy -= dy * force * 0.02;
                }
            }
            
            node.x += node.vx;
            node.y += node.vy;

            // Apply friction
            node.vx *= 0.95;
            node.vy *= 0.95;

            // Smooth edge bouncing
            if (node.x < 0 || node.x > width) {
                node.vx *= -1;
                node.x = Math.max(0, Math.min(width, node.x));
            }
            if (node.y < 0 || node.y > height) {
                node.vy *= -1;
                node.y = Math.max(0, Math.min(height, node.y));
            }
        });
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);
        updateNodes();

        nodes.forEach(node => {
            drawNode(node);
            nodes.forEach(otherNode => {
                if (node !== otherNode) {
                    const distance = Math.sqrt(Math.pow(node.x - otherNode.x, 2) + Math.pow(node.y - otherNode.y, 2));
                    if (distance < 100) {
                        drawEdge(node, otherNode);
                    }
                }
            });
        });

        requestAnimationFrame(animate);
    }

    document.addEventListener('mousemove', function(evt) {
        mouse.x = evt.clientX;
        mouse.y = evt.clientY;
    });

    document.addEventListener('mouseleave', function() {
        mouse.x = undefined;
        mouse.y = undefined;
    });

    // Initial setup
    width = window.innerWidth;
    height = window.innerHeight;
    resizeCanvas();
    
    // Add event listener for window resize
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(resizeCanvas, 250);
    });

    animate();
});