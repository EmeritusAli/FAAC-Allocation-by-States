
async function drawMap() {
    const stateShapes = await d3.json('./nigeria_state_boundaries.geojson')
    const dataset = await d3.csv('./FAAC_State_transposed.csv')

    const cleanStateName = name => name.trim().toLowerCase();

    // Standardize the state names in the GeoJSON
    const stateNameAccessor = d => cleanStateName(d.properties['admin1Name']); // Adjust based on your GeoJSON
    
    const parseDate = d3.timeParse("%Y-%m-%d");

    dataset.forEach(d => {
        d.Date = parseDate(d.Date);
        d.Budget = +d.Budget.replace(/,/g, '');
        d['CleanState'] = cleanStateName(d['State']);
      });


    //  Calculate the average budget for each state
    const stateBudgets = d3.group(dataset, d => d['CleanState']);
       const stateAverages = new Map();
   
    stateBudgets.forEach((values, state) => {
           const totalBudget = d3.sum(values, d => d.Budget);
           const averageBudget = totalBudget / values.length;
           stateAverages.set(state, averageBudget);
       });

    const colorScaleDomain = d3.extent(Array.from(stateAverages.values()));


       const colorScale = d3.scaleSequential()
       .domain(colorScaleDomain)  
       .interpolator(d3.interpolateBlues);


        // Improved dimensions calculation
    const dimensions = {
            width: Math.min(window.innerWidth * 0.9, 1200), // Responsive width, plan to change it later
            height: Math.min(window.innerHeight * 0.7, 800),
            margin: {
                top: 20,
                right: 50,
                bottom: 50,
                left: 20,
            },
        };
    
    dimensions.boundedWidth = dimensions.width - dimensions.margin.left - dimensions.margin.right;
    dimensions.boundedHeight = dimensions.height - dimensions.margin.top - dimensions.margin.bottom;
   
        const projection = d3.geoMercator()
            .fitSize([dimensions.boundedWidth, dimensions.boundedHeight], stateShapes)

        const pathGenerator = d3.geoPath().projection(projection);

        const wrapper = d3.select('.map-wrapper')
            .append('svg')
            .attr('width', dimensions.width)
            .attr('height', dimensions.height)
            .attr('viewBox', `0 0 ${dimensions.width} ${dimensions.height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet')
        
        const bounds = wrapper.append('g')
            .style('transform', `translate(${dimensions.margin.left}px, ${dimensions.margin.top}px)`)
        
        const states = bounds.selectAll('.state')
            .data(stateShapes.features)
            .enter().append('path')
            .attr('class', 'state')
            .attr('d', pathGenerator)
            .attr('fill',  d => {
                const stateName = stateNameAccessor(d);
                const avgBudget = stateAverages.get(stateName);
                // console.log("State in GeoJSON:", stateName, "Avg Budget:", avgBudget);  // Debugging output
                return avgBudget ? colorScale(avgBudget) : '#ccc'; })
            .attr('stroke', 'white')
            .attr('stroke-width', 0.5)
            .text((d) => d.properties['admin1Name'])
            .attr('cursor', 'pointer')
        

        bounds.selectAll('text')
            .data(stateShapes.features)
            .enter().append('text')
            .attr('x', d => pathGenerator.centroid(d)[0])
            .attr('y', d => pathGenerator.centroid(d)[1])
            .text(d => d.properties['admin1Name'])
            .attr('text-anchor', 'middle')
            .attr('alignment-baseline', 'middle')
            .attr('font-size', 10)
            .attr('fill', 'grey')
            .attr('font-weight', 'bold')
            .attr('transform', 'translate(0, 5)')

        const legendGroup = wrapper.append("g")
            .attr("transform", `translate(${dimensions.boundedWidth / 2 + 200}, 
                ${
                dimensions.width < 800
                ? dimensions.boundedHeight - 80
                :dimensions.boundedHeight - 50
                })`) 
        
        const legendTitle = legendGroup.append("text")
            .attr("y", -23)
            .attr("class", "legend-title")
            .text("Average Budget")


        const legendByline = legendGroup.append("text")
            .attr("y", -9)
            .attr("class", "legend-byline")
            .text("2017 - 2024")
        
        const defs = wrapper.append("defs")
        const legendGradientId = "legend-gradient"
        const gradient = defs.append("linearGradient")
            .attr("id", legendGradientId)
            .selectAll("stop")
            .data(colorScale.range())
            .enter().append("stop")
            .attr("stop-color", d => d)
            .attr("offset", (d, i) => `${
                i * 100 / (colorScale.range().length - 1)
            }%`)
        
        const legendWidth = 120
        const legendHeight = 16
        const legendGradient = legendGroup.append("rect")
            .attr("x", -legendWidth / 2)
            .attr("height", legendHeight)
            .attr("width", legendWidth)
            .style("fill", `url(#${legendGradientId})`)

        const legendValueRight = legendGroup.append("text")
            .attr("class", "legend-value")
            .attr("x", legendWidth / 2 + 10)
            .attr("y", legendHeight / 2)
            .text(d3.format(".2f")(colorScaleDomain[1] / 1e9) + "B")
            .style("dominant-baseline", "middle")


        const legendValueLeft = legendGroup.append("text")
            .attr("class", "legend-value")
            .attr("x", -legendWidth / 2 - 10)
            .attr("y", legendHeight / 2)
            .text(d3.format(".2f")(colorScaleDomain[0] / 1e9) + "B")
            .attr("text-anchor", "end")
            .style("dominant-baseline", "middle")


        navigator.geolocation.getCurrentPosition(myPosition => {
            const [x, y] = projection([myPosition.coords.longitude, myPosition.coords.latitude])
            wrapper.append("circle")   // doesn't show the exact location, to investigate later
                .attr("class", "my-position")
                .attr("cx", x)
                .attr("cy", y)
                .attr("r", 5)
                .attr("fill", "red")
            });

            // console.log(stateShapes.features.map(stateNameAccessor));
            // console.log('GeoJSON State Names:', stateShapes.features.map(stateNameAccessor));
            // console.log('CSV State Names:', dataset.map(d => cleanStateName(d['State'])));
        
        function onClick(event, datum) {
            const stateName = stateNameAccessor(datum);
            console.log("Hovering over state:", stateName); 
            const avgBudget = stateAverages.get(stateName);
            
            if (avgBudget === undefined) {
                // console.log(`No matching state found in dataset for: ${stateName}`);
                // console.log("Available states in dataset:", dataset.map(d => d['CleanState']));
                return;
            }

            const originalStateName = stateShapes.features.find(d => stateNameAccessor(d) === stateName)?.properties['admin1Name'] || stateName;;
            
            const stateData = dataset.filter(d => cleanStateName(d.State) === stateName)
                             .sort((a, b) => a.Date - b.Date);

            console.log("State Data:", stateData);

            d3.select('#state-name').text(originalStateName);
            d3.select('#average-budget').text(`Average Budget: ${d3.format(",.0f")(avgBudget)}`);

            d3.select('#chart').html('');
            const animateChart = createChart(stateData);
            animateChart();
         }
        

        function createChart(data) {
            const chartDimensions = {
            width: d3.select('#chart').node().getBoundingClientRect().width,
            height: 300,
            margin: { top: 20, right: 20, bottom: 30, left: 45 }
        };
        chartDimensions.boundedWidth = chartDimensions.width - chartDimensions.margin.left - chartDimensions.margin.right;
        chartDimensions.boundedHeight = chartDimensions.height - chartDimensions.margin.top - chartDimensions.margin.bottom;
    
            const svg = d3.select("#chart").append("svg")
                .attr("width", chartDimensions.width)
                .attr("height", chartDimensions.height)
                .attr("viewBox", `0 0 ${chartDimensions.width} ${chartDimensions.height}`)
                .attr("preserveAspectRatio", "xMidYMid meet")
                .append("g")
                .attr("transform", `translate(${chartDimensions.margin.left},${chartDimensions.margin.top})`);
    
            const x = d3.scaleTime()
                .domain(d3.extent(data, d => d.Date))
                .range([0, chartDimensions.boundedWidth])
    
            const y = d3.scaleLinear()
                .domain([0, d3.max(data, d => d.Budget)])
                .range([chartDimensions.boundedHeight, 0]);
    
            const area = d3.area()
                .x(d => x(d.Date))
                .y0(chartDimensions.boundedHeight)
                .y1(d => y(d.Budget))
                .curve(d3.curveCatmullRom);


            svg.append("clipPath")
                .attr("id", "clip")
                .append("rect")
                .attr("width", 0)
                .attr("height", chartDimensions.boundedHeight);
    
            svg.append("path")
                .datum(data)
                .attr("fill", "cornflowerblue")
                .attr("clip-path", "url(#clip)")
                .attr("d", area)
                .attr("fill-opacity", 0.1)
                .attr("stroke", "cornflowerblue")
                .attr("stroke-opacity", 1)
                .attr('stroker-width', 9);
    
            svg.append("g")
                .attr("transform", `translate(0,${chartDimensions.boundedHeight})`)
                .call(d3.axisBottom(x));
    
            svg.append("g")
                .call(d3.axisLeft(y).tickFormat(d => d3.format(".0f")(d / 1e9)));
    
            svg.append("text")
                .attr("class", "axis-label")
                .attr("text-anchor", "middle")
                .attr("x", chartDimensions.boundedWidth / 2)
                .attr("y", chartDimensions.boundedHeight + chartDimensions.margin.bottom)
                .text("Year");
    
            svg.append("text")
                .attr("class", "axis-label")
                .attr("text-anchor", "middle")
                .attr("transform", "rotate(-90)")
                .attr("y", 0 - chartDimensions.margin.left - 5)
                .attr("x", 0 - (chartDimensions.boundedHeight / 2))
                .attr("dy", "2em")
                .text("Budget (Billion naira)");

            function animateChart() {
                    // Animate the clip path
                    svg.select("#clip rect")
                        .attr("width", 0)
                        .transition()
                        .duration(2000)
                        .attr("width", chartDimensions.boundedWidth);
            
                    // Animate the area path
                    const pathLength = areaPath.node().getTotalLength();
                    areaPath
                        .attr("stroke-dasharray", pathLength + " " + pathLength)
                        .attr("stroke-dashoffset", pathLength)
                        .transition()
                        .duration(2000)
                        .attr("stroke-dashoffset", 0);
                }
    
            const tooltip = d3.select("body").append("div")
                .attr("class", "chart-tooltip")
                .style("opacity", 0);
    
            const bisect = d3.bisector(d => d.Date).center;

            const hoverLine = svg.append("line")
            .attr("class", "hover-line")
            .attr("y1", 0)
            .attr("y2", chartDimensions.boundedHeight)
            .style("opacity", 0)
            .attr("stroke", "cornflowerblue")
            .attr("stroke-dasharray", 4)                
            .attr("stroke-width", 2)
            .attr("pointer-events", "none");

            const hoverCircle = svg.append("circle")
            .attr("class", "hover-circle")
            .attr("r", 5)
            .style("opacity", 0)
            .attr("fill", "cornflowerblue")
            .attr("pointer-events", "none");

            svg.append("rect")
                .attr("width", chartDimensions.boundedWidth)
                .attr("height", chartDimensions.boundedHeight)
                .style("fill", "none")
                .style("pointer-events", "all")
                .on("mouseover", () => {
                    tooltip.style("opacity", 1);
                    hoverLine.style("opacity", 1);
                    hoverCircle.style("opacity", 1);
                })
                .on("mouseout", () => {
                    tooltip.style("opacity", 0);
                    hoverLine.style("opacity", 0);
                    hoverCircle.style("opacity", 0);
                })
                .on("mousemove", function(event) {
                    const x0 = x.invert(d3.pointer(event)[0]);
                    const i = bisect(data, x0);  // Find the index of the closest date, 1 as 3rd argument is the start index
                    const d0 = data[i - 1];
                    const d1 = data[i];
                    const d = x0 - d0.Date > d1.Date - x0 ? d1 : d0;

                    hoverLine.attr("x1", x(d.Date)).attr("x2", x(d.Date));
                    hoverCircle.attr("cx", x(d.Date)).attr("cy", y(d.Budget));
                    tooltip.html(`Date: ${d3.timeFormat("%Y-%m-%d")(d.Date)}<br>Budget: ${d3.format(",.0f")(d.Budget)}`)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 10) + "px");
                });

            animateChart();
            return animateChart;

        }

        states.on('click', onClick)

        d3.select('svg').on('click', function(event) {
            if (event.target === this) {
                d3.select('#state-name').text('Select a state');
                d3.select('#average-budget').text('Click on a state to see details');
                d3.select('#chart').html('');
            }
        });


    };

    drawMap()