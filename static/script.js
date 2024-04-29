function updateGenerateButtonState() {
    const hasEditableContainers = Array.from(document.querySelectorAll('.container')).some(container => !container.classList.contains('used'));
    document.getElementById('generateButton').disabled = !hasEditableContainers;
}

function updateAddButtonState() {
    const allContainersUsed = Array.from(document.querySelectorAll('.container')).every(container => container.classList.contains('used'));
    document.getElementById('addRegionButton').disabled = !allContainersUsed;
}

function renderUMAPVisualization(data) {
    const visualizationContainer = document.getElementById('umapVisualization');

    if (!data || data.error || data.length === 0) {
        console.log("No data available for visualization.");
        visualizationContainer.style.display = 'none';
        visualizationContainer.innerHTML = '<p>No data available.</p>';
    } else {
        visualizationContainer.style.display = 'block';
        visualizationContainer.innerHTML = '';

        const promptColors = {};
        const colorPalette = Plotly.d3.scale.category10();
        data.forEach(d => {
            if (!promptColors.hasOwnProperty(d.prompt_id)) {
                promptColors[d.prompt_id] = colorPalette(Object.keys(promptColors).length);
            }
        });

        const groupedData = data.reduce((acc, d) => {
            if (!acc[d.prompt_id]) acc[d.prompt_id] = [];
            acc[d.prompt_id].push(d);
            return acc;
        }, {});

        const uniqueSteps = [...new Set(data.map(d => d.step))].sort((a, b) => a - b);

        // Determine the range for the axes
        let allX = [], allY = [];
        data.forEach(d => {
            allX.push(d.x);
            allY.push(d.y);
        });
        const xRange = [Math.min(...allX), Math.max(...allX)];
        const yRange = [Math.min(...allY), Math.max(...allY)];

        const traces = Object.keys(groupedData).map(prompt_id => ({
            x: groupedData[prompt_id].map(d => d.x),
            y: groupedData[prompt_id].map(d => d.y),
            mode: 'markers',
            type: 'scatter',
            name: `Prompt ID: ${prompt_id}`,
            marker: {
                size: 5,
                color: promptColors[prompt_id],
                opacity: 0.8
            }
        }));

        const frames = uniqueSteps.map(step => ({
            name: step.toString(),
            data: Object.keys(groupedData).map(prompt_id => ({
                x: groupedData[prompt_id].filter(d => d.step <= step).map(d => d.x),
                y: groupedData[prompt_id].filter(d => d.step <= step).map(d => d.y),
                marker: {
                    size: groupedData[prompt_id].map(d => d.step === step ? 10 : 5),
                    opacity: groupedData[prompt_id].map(d => d.step === step ? 1.0 : 0.8)
                }
            }))
        }));

        const layout = {
            title: 'UMAP Visualization Animated Over Steps',
            xaxis: { title: 'UMAP Dimension 1', range: xRange },
            yaxis: { title: 'UMAP Dimension 2', range: yRange },
            showlegend: true,
            updatemenus: [{
                type: 'buttons',
                showactive: false,
                buttons: [{
                    label: 'Play',
                    method: 'animate',
                    args: [null, {
                        fromcurrent: true,
                        transition: { duration: 100 },
                        frame: { duration: 100, redraw: true }
                    }],
                }, {
                    label: 'Pause',
                    method: 'animate',
                    args: [[null], {
                        mode: "immediate",
                        transition: { duration: 0 }
                    }]
                }]
            }]
        };

        Plotly.newPlot('umapVisualization', traces, layout, {displayModeBar: true}).then(function() {
            Plotly.addFrames('umapVisualization', frames);
        });
    }
}

    document.getElementById('generateButton').addEventListener('click', function() {
        document.getElementById('generateButton').disabled = true;
        const loader = document.createElement('div');
        loader.className = 'loader';
        document.body.appendChild(loader);  // Add loader to the body or a specific container

        // Gather all fetch promises for processing prompts
        let fetchPromises = [];
    
        document.querySelectorAll('.container:not(.used)').forEach(function(container) {
            const promptInput = container.querySelector('.promptInput'); // Get the textarea
            const prompt = promptInput.value;
            const imageGallery = container.querySelector('.imageGallery');
            container.classList.add('used');
            if (prompt) { // Only proceed if the prompt is not empty
                // Mark the container as used
                
                // Prepare the fetch promise
                let fetchPromise = fetch('/api/generate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ prompt: prompt }),
                })
                .then(response => response.json())
                .then(data => {
                    imageGallery.innerHTML = ''; // Clear the gallery
                    data.images.forEach(imageSrc => {
                        const img = document.createElement('img');
                        img.src = imageSrc;
                        img.classList.add('image');
                        img.style.opacity = 0; // Start with opacity 0
                        imageGallery.appendChild(img);
                        setTimeout(() => { img.style.opacity = 1; }, 50); // Fade in effect
                    });
                    imageGallery.style.display = 'flex'; // Start hidden
                    setTimeout(() => {
                        container.querySelector('.imageGallery').scrollLeft = container.querySelector('.imageGallery').scrollWidth;
                    }, 100); // Adjust the timeout as minimally needed
                    
                    console.log(container.querySelector('.imageGallery').scrollLeft);
                    container.setAttribute('data-prompt-id', data.prompt_id);
                    const promptIdDisplay = document.createElement('div');
                    promptIdDisplay.className = 'prompt-id-display'; // Optional: for styling
                    promptIdDisplay.textContent = `Prompt ID: ${data.prompt_id}`;
                    container.appendChild(promptIdDisplay);
                    promptInput.readOnly = true; // Make the textarea unmodifiable
                    promptInput.disabled = true;
                });
                fetchPromises.push(fetchPromise);
            } else {
                console.log('Empty prompt skipped');
            }
        });

        Promise.all(fetchPromises).then(() => {
          fetch('/api/get-umap')
          .then(response => response.json())
          .then(data => {
              console.log("Data fetched successfully:", data);
              // You can call a function here to handle the data, such as rendering a chart
              renderUMAPVisualization(data);
              updateGenerateButtonState();
              updateAddButtonState();
          })
          .catch(error => {
              console.error('Error fetching UMAP data:', error);
              updateGenerateButtonState();
              updateAddButtonState();
          });
        })
        .finally(() => {
            document.getElementById('generateButton').disabled = false;  // Re-enable the button after all operations
        });
        
      });


    
    
    
    document.getElementById('addRegionButton').addEventListener('click', function() {
        // Create a new container div
        const newContainer = document.createElement('div');
        newContainer.classList.add('container');

        // Assign a unique ID to the container (optional, if you want to target it specifically later)
        newContainer.id = 'container-' + document.querySelectorAll('.container').length;

        // Create a new textarea
        const newTextArea = document.createElement('textarea');
        newTextArea.classList.add('promptInput');
        newTextArea.placeholder = 'Enter your prompt here...';

        // Create a new image gallery div
        const newImageGallery = document.createElement('div');
        newImageGallery.classList.add('imageGallery');
        newImageGallery.style.display = 'none'; // Start hidden

        // Create a new t-SNE plot div
        const newTsnePlot = document.createElement('div');
        newTsnePlot.classList.add('tsnePlot');

        // Create a delete button
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.classList.add('deleteButton');

        // Add event listener to the delete button
        deleteButton.addEventListener('click', function() {
            const promptId = newContainer.getAttribute('data-prompt-id');
            fetch(`/api/delete-prompt/${promptId}`, {
                method: 'POST',
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    console.log(data.message);
                    // After successfully deleting, fetch UMAP data to update visualization
                    return fetch('/api/get-umap'); // Return this fetch promise for chaining
                } else {
                    console.error('Failed to delete prompt:', data.message);
                    throw new Error('Deletion failed'); // Throw an error to break the chain
                }
            })
            .then(response => response.json()) // Handle the UMAP data fetch response
            .then(data => {
                console.log("Data fetched successfully:", data);
                renderUMAPVisualization(data); // Call the render function with new data
                newContainer.remove(); // Remove the container if the backend deletion was successful
                updateGenerateButtonState();
                updateAddButtonState();
                
            })
            .catch(error => {
                console.error('Error:', error); // This will catch any errors from the entire chain
                newContainer.remove(); // Remove the container if the backend deletion was successful
                updateGenerateButtonState();
                updateAddButtonState();
            });
        });

        // Append the textarea, image gallery, and delete button to the container
        newContainer.appendChild(newTextArea);
        newContainer.appendChild(newImageGallery);
        // newContainer.appendChild(newTsnePlot);
        newContainer.appendChild(deleteButton);

        const leftSideDiv = document.querySelector('.left-side');
        if (leftSideDiv) {
            leftSideDiv.appendChild(newContainer);
        } else {
            console.error('Left-side division not found!');
        }
        updateGenerateButtonState();
        updateAddButtonState();
    });