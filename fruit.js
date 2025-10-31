// Fruit falling physics system
// Requires: Matter.js, pathseg.min.js, decomp.js, svg_demo.js

class FruitSystem {
    constructor() {
        this.engine = null;
        this.render = null;
        this.canvas = null;
        this.mouseConstraint = null;
        this.walls = [];
        this.fruitVertices = {};
        this.fruits = {};
        this.fruitId = 1;
        this.svgsLoaded = 0;
        this.isMousePressed = false;
        this.isMouseOverFruit = false;
        
        // Color-based fruit configurations
        this.colorDefinitions = {
            red: '#e53935',
            pink: '#DA356E', 
            orange: '#F5840C',
            green: '#7D8921',
            purple: '#9C3BCC',
            blue: '#6B6BE2'
        };

        this.colorConfigs = {
            red: [
                { name: 'apple', path: 'assets/fruit/apple.svg' },
                { name: 'cherry', path: 'assets/fruit/cherry.svg' }
            ],
            pink: [
                //{ name: 'pomegranate', path: 'assets/fruit/pomegranate.svg' },
                { name: 'dragonfruit', path: 'assets/fruit/dragonfruit.svg' }
            ],
            orange: [
                { name: 'orange', path: 'assets/fruit/orange.svg' },
                //{ name: 'pumpkin', path: 'assets/fruit/pumpkin.svg' }
            ],
            green: [
                { name: 'pear', path: 'assets/fruit/pear.svg' },
                { name: 'lime', path: 'assets/fruit/lime.svg' }
            ],
            purple: [
                { name: 'grape', path: 'assets/fruit/grape.svg' },
                { name: 'plum', path: 'assets/fruit/plum.svg' }
            ],
            blue: [
                { name: 'blueberry', path: 'assets/fruit/blueberry.svg' },
                //{ name: 'blackberry', path: 'assets/fruit/blackberry.svg' }
            ]
        };

        // Flatten all fruit configs for loading
        this.allFruits = [];
        Object.entries(this.colorConfigs).forEach(([colorName, fruits]) => {
            fruits.forEach(fruit => {
                this.allFruits.push({
                    ...fruit,
                    color: this.colorDefinitions[colorName]
                });
            });
        });

        this.totalSvgs = this.allFruits.length;
    }

    async init(canvasId = 'fruit-canvas') {
        // Check if required libraries are loaded
        if (typeof Matter === 'undefined') {
            throw new Error('Matter.js is required');
        }
        if (typeof decomp === 'undefined') {
            throw new Error('decomp.js is required');
        }

        const { Engine, Render, Runner, Bodies, Body, Composite, Common, Vertices, Svg, Mouse, MouseConstraint } = Matter;
        
        Common.setDecomp(decomp);
        
        // Create or get canvas
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.id = canvasId;
            this.canvas.style.position = 'fixed';
            this.canvas.style.top = '0';
            this.canvas.style.left = '0';
            this.canvas.style.width = '100%';
            this.canvas.style.height = '100%';
            this.canvas.style.pointerEvents = 'none';
            this.canvas.style.zIndex = '10';
            document.body.appendChild(this.canvas);
        }

        // Setup physics
        this.engine = Engine.create();
        this.engine.world.gravity.y = 0.8;
        
        this.render = Render.create({
            canvas: this.canvas,
            engine: this.engine,
            options: {
                width: window.innerWidth,
                height: window.innerHeight,
                background: 'transparent',
                wireframes: false,
                pixelRatio: window.devicePixelRatio || 1
            }
        });
        
        Render.run(this.render);
        Runner.run(Runner.create(), this.engine);

        // Create fruits object from all configs
        this.allFruits.forEach(config => {
            this.fruits[config.name] = {
                vertices: null,
                color: config.color,
                density: 1
            };
        });

        // Load SVG assets
        await this.loadSVGs();
        
        // Setup walls
        this.createWalls();
        
        // Setup mouse control
        this.setupMouseControl();
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('Fruit system initialized');
    }

    select(root, selector) {
        return Array.prototype.slice.call(root.querySelectorAll(selector));
    }

    loadSvg(url) {
        return fetch(url)
            .then(response => response.text())
            .then(raw => (new window.DOMParser()).parseFromString(raw, 'image/svg+xml'));
    }

    async loadSVGs() {
        const { Vertices, Svg } = Matter;
        
        const loadPromises = this.allFruits.map(async (config) => {
            try {
                const root = await this.loadSvg(config.path);
                const vertexSets = this.select(root, 'path')
                    .map(path => Vertices.scale(Svg.pathToVertices(path, 1), 2.5, 2.5));

                this.fruitVertices[config.name] = vertexSets;
                
                if (this.fruits[config.name]) {
                    this.fruits[config.name].vertices = vertexSets;
                    this.fruits[config.name].color = config.color;
                }
                
                this.svgsLoaded++;
            } catch (error) {
                console.warn(`Failed to load ${config.name}:`, error);
                this.svgsLoaded++;
            }
        });

        await Promise.all(loadPromises);
        console.log(`Loaded ${this.svgsLoaded}/${this.totalSvgs} fruit SVGs`);
    }

    createWalls() {
        const { Bodies, Composite } = Matter;
        const thickness = 200;
        
        // Remove existing walls
        this.walls.forEach(wall => Composite.remove(this.engine.world, wall));
        
        this.walls = [
            // Bottom wall
            Bodies.rectangle(window.innerWidth/2, window.innerHeight + thickness/2, window.innerWidth + thickness*2, thickness, { isStatic: true }),
            // Left wall
            Bodies.rectangle(-thickness/2, window.innerHeight/2, thickness, window.innerHeight + thickness*2, { isStatic: true }),
            // Right wall
            Bodies.rectangle(window.innerWidth + thickness/2, window.innerHeight/2, thickness, window.innerHeight + thickness*2, { isStatic: true }),
            // Top wall
            Bodies.rectangle(window.innerWidth/2, -thickness/2, window.innerWidth + thickness*2, thickness, { isStatic: true })
        ];
        
        this.walls.forEach(wall => {
            wall.render.visible = false;
            wall.friction = 1.0;
        });
        
        Composite.add(this.engine.world, this.walls);
    }

    setupMouseControl() {
        const { Mouse, MouseConstraint, Composite, Body } = Matter;
        
        const mouse = Mouse.create(this.render.canvas);
        this.mouseConstraint = MouseConstraint.create(this.engine, {
            mouse: mouse,
            constraint: {
                stiffness: 0.1,
                render: { visible: false }
            }
        });

        Composite.add(this.engine.world, this.mouseConstraint);

        // Mouse release safeguards
        const forceMouseRelease = () => {
            if (this.mouseConstraint.constraint.bodyB) {
                const body = this.mouseConstraint.constraint.bodyB;
                
                if (body.velocity) {
                    body.velocity.x *= 0.8;
                    body.velocity.y *= 0.8;
                    
                    const maxVelocity = 15;
                    const currentSpeed = Math.sqrt(body.velocity.x * body.velocity.x + body.velocity.y * body.velocity.y);
                    if (currentSpeed > maxVelocity) {
                        const ratio = maxVelocity / currentSpeed;
                        body.velocity.x *= ratio;
                        body.velocity.y *= ratio;
                    }
                }
                
                this.mouseConstraint.constraint.bodyB = null;
                this.mouseConstraint.constraint.bodyA = null;
                this.mouseConstraint.constraint.pointA = null;
                this.mouseConstraint.constraint.pointB = null;
            }
        };

        // Mouse event handling
        document.addEventListener('mousedown', () => this.isMousePressed = true);
        document.addEventListener('mouseup', () => {
            this.isMousePressed = false;
            forceMouseRelease();
        });
        document.addEventListener('mouseleave', forceMouseRelease);
        window.addEventListener('blur', forceMouseRelease);
        this.render.canvas.addEventListener('mouseleave', forceMouseRelease);

        // Smart pointer events
        document.addEventListener('mousemove', (event) => {
            const rect = this.render.canvas.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            
            if (mouseX >= 0 && mouseX <= rect.width && mouseY >= 0 && mouseY <= rect.height) {
                const wasOverFruit = this.isMouseOverFruit;
                this.isMouseOverFruit = this.checkMouseOverFruit(mouseX, mouseY);
                
                if (this.isMouseOverFruit !== wasOverFruit) {
                    this.render.canvas.style.pointerEvents = this.isMouseOverFruit ? 'auto' : 'none';
                }
            }
        });

        // Override mouse constraint to only work when pressed
        const originalUpdate = this.mouseConstraint.update;
        this.mouseConstraint.update = function() {
            if (this.isMousePressed) {
                originalUpdate.call(this);
            } else {
                if (this.constraint.bodyB) {
                    forceMouseRelease();
                }
            }
        }.bind(this);
    }

    checkMouseOverFruit(x, y) {
        const { Composite } = Matter;
        const bodies = Composite.allBodies(this.engine.world);
        
        for (let body of bodies) {
            if (body.label && body.label.includes('fruit')) {
                const padding = 15;
                if (x >= body.bounds.min.x - padding && x <= body.bounds.max.x + padding &&
                    y >= body.bounds.min.y - padding && y <= body.bounds.max.y + padding) {
                    return true;
                }
            }
        }
        return false;
    }

    setupEventListeners() {
        // Attach to fruit words
        this.attachToFruitWords();

        // Resize handler
        window.addEventListener('resize', () => {
            this.render.options.width = window.innerWidth;
            this.render.options.height = window.innerHeight;
            this.canvas.width = window.innerWidth * (window.devicePixelRatio || 1);
            this.canvas.height = window.innerHeight * (window.devicePixelRatio || 1);
            this.canvas.style.width = window.innerWidth + 'px';
            this.canvas.style.height = window.innerHeight + 'px';
            
            this.createWalls();
        });
    }

    attachToFruitWords() {
        document.querySelectorAll('.fruit-word').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const color = el.dataset.color;
                if (color) {
                    this.spawnFruitByColor(color);
                }
            });
        });
    }

    spawnFruitByColor(color, x = window.innerWidth/2) {
        const colorFruits = this.colorConfigs[color];
        if (!colorFruits || colorFruits.length === 0) {
            return;
        }
        
        const randomFruit = colorFruits[Math.floor(Math.random() * colorFruits.length)];
        this.spawnFruit(randomFruit.name, x);
    }
    
    spawnFruit(type, x = window.innerWidth/2) {
        const { Bodies, Body, Composite } = Matter;
        
        const spec = this.fruits[type];
        if (!spec || !spec.vertices || spec.vertices.length === 0) {
            return;
        }

        const options = {
            density: spec.density,
            friction: 0.2,
            restitution: 0.1,
            render: { fillStyle: spec.color }
        };

        const spawnX = Math.max(50, Math.min(window.innerWidth - 50, x + (Math.random() - 0.5) * 60));
        const spawnY = Math.max(50, 20 + Math.random() * 100);

        const body = Bodies.fromVertices(spawnX, spawnY, spec.vertices, options);
        
        if (body) {
            Body.setVelocity(body, { 
                x: (Math.random() - 0.5) * 2,
                y: Math.random() * 1
            });
            Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.3);
            
            body.label = `fruit-${type}-${this.fruitId++}`;
            Composite.add(this.engine.world, body);
        }
    }

    // Public API
    addFruitWord(element, color) {
        element.classList.add('fruit-word');
        element.dataset.color = color;
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            this.spawnFruitByColor(color);
        });
    }

    destroy() {
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        // Clean up event listeners would go here
    }
}

// Export for use in other files
window.FruitSystem = FruitSystem;
