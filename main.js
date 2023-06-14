// Set up the dimensions of the map container
const width = 1000;
const height = 800;

// Define a projection for the map
const projection = d3.geoMercator()
  .center([80, 80])
  .scale(200)
  .translate([width/2, height/2]);

// Create a path generator based on the projection
const path = d3.geoPath().projection(projection);

// Define the zoom behavior
const zoom = d3.zoom()
  .scaleExtent([1, 8])
  .on("zoom", function (event) {
    svg.attr("transform", event.transform);
  });

// Create an SVG container for the map
const svg = d3.select("#map-container")
  .append("svg")
  .attr("width", width*2)
  .attr("height", height*2)
  .call(zoom)
  .append("g");

// Zoom in and out buttons
d3.select("#zoom-in").on("click", function() {
  zoom.scaleBy(svg.transition().duration(750), 1.3);
});

d3.select("#zoom-out").on("click", function() {
  zoom.scaleBy(svg.transition().duration(750), 1 / 1.3);
});

// Add the variable here
let lastClickedRegion = null;

// Tooltip
const tooltip = d3.select("#tooltip");
const tooltipContent = d3.select("#tooltip-content");

d3.select("#close-tooltip").on("click", function() {
  tooltip.style("opacity", 0);
});

// Bar Chart
const barChartMargin = {top: 30, right: 20, bottom: 30, left: 80};
const barChartWidth = 500 - barChartMargin.left - barChartMargin.right;
const barChartHeight = 300 - barChartMargin.top - barChartMargin.bottom;

const x = d3.scaleBand().range([0, barChartWidth]).padding(0.1);
const y = d3.scaleLinear().range([barChartHeight, 0]);

const barChartSvg = d3.select("#bar-chart").append("svg")
    .attr("width", barChartWidth + barChartMargin.left + barChartMargin.right)
    .attr("height", barChartHeight + barChartMargin.top + barChartMargin.bottom)
    .append("g")
    .attr("transform", "translate(" + barChartMargin.left + "," + barChartMargin.top + ")");

// Valid years
const validYears = [1970,1980,1990,1995,2000,2005,2006,2007,2008,2009,2010];
const minYear = validYears[0];
const maxYear = validYears[validYears.length - 1];

// Update slider's range
d3.select("#year-slider")
  .attr("min", minYear)
  .attr("max", maxYear)
  .attr("value", minYear); // set initial value

// Load the birth rate data
d3.csv("data_demografic_new.csv").then(function(data) {
  // Load the GeoJSON region data
  d3.json("regions.geojson").then(function(geojson) {
    const colorScale = d3.scaleSequential(d3.interpolateBlues)
      .domain([0, d3.max(data, d => +d.Born)]); // adjust the domain as per your data


    // Create the map
    const map = svg.selectAll("path")
      .data(geojson.features)
      .enter()
      .append("path")
      .attr("d", path)
      .style("fill", function(d) {
        let yearData = data.find(row => row.region === d.properties.name && +row.Year === minYear); // initialize with minYear
        return yearData ? colorScale(yearData.Born) : "#ccc";  // if no data found, fill with grey
      })
      .style("stroke", "black") 
      .on("click", function(event, d) {
        // If there was a previously clicked region, reset its style
        svg.selectAll(".selected")
          .classed("selected", false)
          .style("stroke", "black")  // Reset the stroke color
          .style("stroke-width", "1");  // Reset the stroke width

        // Apply the highlight style to the newly clicked region
        d3.select(this)
          .classed("selected", true)
          .style("stroke", "orange")  // Highlight the stroke color
          .style("stroke-width", "2");  // Increase the stroke width

        // Store the selected region's name
        lastClickedRegion = d.properties.name;
          
        let year = +d3.select("#year-slider").property("value");
        // Snap to valid years
        year = validYears.reduce((prev, curr) => Math.abs(curr - year) < Math.abs(prev - year) ? curr : prev);
          
        const regionData = data.find(row => row.region === d.properties.name && +row.Year === year);
        if (regionData) {
          //update barchart 
          updateBarChart(regionData);
          d3.select("#bar-chart").style("display", "block");
          tooltip.style("opacity", 1);
          tooltipContent.html(`
            <p><strong>Region</strong>: ${regionData.region}</p>
            <p><strong>Year</strong>: ${regionData.Year}</p>
            <p><strong>Number of Birth</strong>: ${regionData.Born}</p>
            <p><strong>Number of Death</strong>: ${regionData.Died}</p>
            <p><strong>Difference</strong>: ${regionData.Diff}</p>
          `);
        } else {
          d3.select("#bar-chart").style("display", "none");
          tooltip.style("opacity", 1);
          tooltipContent.html(`No info for this ${d.properties.name} for year ${year}`);
        }
      });

    // Call this function right after defining it
    d3.select("#year-slider").dispatch("input");
    // Update the map when the slider changes
    // Replace your existing 'input' event handler for the slider with this
    d3.select("#year-slider").on("input", function() {
      let year = +this.value;

      // Snap to valid years
      year = validYears.reduce((prev, curr) => Math.abs(curr - year) < Math.abs(prev - year) ? curr : prev);

      const joinedData = joinData(geojson.features, data, year);

      map.data(joinedData)
        .style("fill", d => colorScale(d.properties.birthRate))
        .select("title")
        .text(d => d.properties.region + ": " + d.properties.birthRate);

      // Update the year display when the slider changes
      d3.select("#year-display").text(year);

      // If a region was previously clicked, update the tooltip and the bar chart for that region
      if (lastClickedRegion) {
        const regionData = data.find(row => row.region === lastClickedRegion && +row.Year === year);
        if (regionData) {
          updateBarChart(regionData);
          d3.select("#bar-chart").style("display", "block");
          tooltip.style("opacity", 1);
          tooltipContent.html(`
            <p><strong>Region</strong>: ${regionData.region}</p>
            <p><strong>Year</strong>: ${regionData.Year}</p>
            <p><strong>Number of Birth</strong>: ${regionData.Born}</p>
            <p><strong>Number of Death</strong>: ${regionData.Died}</p>
            <p><strong>Difference</strong>: ${regionData.Diff}</p>
          `);
        } else {
          d3.select("#bar-chart").style("display", "none");
          tooltip.style("opacity", 1);
          tooltipContent.html(`No info for this ${lastClickedRegion} for year ${year}`);
        }
      }
    });

    function updateBarChart(data) {
      const chartData = [
        { category: "Born", value: +data.Born },
        { category: "Died", value: +data.Died }
      ];
    
      x.domain(chartData.map(d => d.category));
      y.domain([0, d3.max(chartData, d => d.value)]);
    
      barChartSvg.selectAll(".bar").remove();
      barChartSvg.selectAll(".bar-label").remove();  // Remove old labels
    
      barChartSvg.selectAll(".bar")
        .data(chartData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.category))
        .attr("width", x.bandwidth())
        .attr("y", d => y(d.value))
        .attr("height", d => barChartHeight - y(d.value))
        .attr("fill", "#3E94DB"); // Change the bar color
    
      // Add labels
      barChartSvg.selectAll(".bar-label")
        .data(chartData)
        .enter()
        .append("text")
        .attr("class", "bar-label")
        .attr("x", d => x(d.category) + x.bandwidth() / 2) // center the text
        .attr("y", d => y(d.value) - 5) // position above the top of the bar
        .text(d => d.value)
        .attr("text-anchor", "middle")
        .attr("fill", "black");
    
      barChartSvg.selectAll("g").remove();
    
      barChartSvg.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(0," + barChartHeight + ")")
        .call(d3.axisBottom(x));

      barChartSvg.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(y));
    }
  });
});

function joinData(regions, data, year) {
  const dataForYear = data.filter(row => +row.Year === year);

  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];
    const match = dataForYear.find(row => row.region === region.properties.name);

    if (match) {
      region.properties.birthRate = +match.Born;
    } else {
      region.properties.birthRate = 0;
    }
  }

  return regions;
}

// Get the slider and its position
const slider = document.querySelector('#year-slider');
const sliderRect = slider.getBoundingClientRect();

// Get the labels
const label1990 = document.querySelector('#label-1990');
const label2007 = document.querySelector('#label-2007');

// Position the labels
label1990.style.left = `${sliderRect.left + ((1990 - minYear) / (maxYear - minYear)) * sliderRect.width}px`;
label2007.style.left = `${sliderRect.left + ((2007 - minYear) / (maxYear - minYear)) * sliderRect.width}px`;

// If the window is resized, re-position the labels
window.addEventListener('resize', function() {
  const sliderRect = slider.getBoundingClientRect();
  label1990.style.left = `${sliderRect.left + ((1990 - minYear) / (maxYear - minYear)) * sliderRect.width}px`;
  label2007.style.left = `${sliderRect.left + ((2007 - minYear) / (maxYear - minYear)) * sliderRect.width}px`;
});

// Create an object to store the explanations for each year
const yearExplanations = {
  1990: "After the collapse of the Soviet Union in 1989, Russia's gross domestic product declined by more than 5 percent per year for 10 years, its birth rate sharply declined, and its death rate peaked.",
  2007: "In 2007 Russian government created Maternal (family) capital policy, which affected birth rate positevely."
};

// Get the info box elements
const infoBox = document.querySelector("#info-box");
const infoBoxTitle = document.querySelector("#info-box-title");
const infoBoxContent = document.querySelector("#info-box-content");

// Add event listeners to the labels
label1990.addEventListener('click', function() {
  slider.value = 1990; // Set the slider value
  slider.dispatchEvent(new Event('input')); // Dispatch the input event
  showInfoBox(1990);
});

label2007.addEventListener('click', function() {
  slider.value = 2007; // Set the slider value
  slider.dispatchEvent(new Event('input')); // Dispatch the input event
  showInfoBox(2007);
});


// Define a function to show the info box
function showInfoBox(year) {
  infoBoxTitle.textContent = `Year ${year}`;
  infoBoxContent.textContent = yearExplanations[year];
  infoBox.style.display = "block";  // Show the info box
}
