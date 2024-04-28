document.getElementById('generateButton').addEventListener('click', function() {
    // Gather all fetch promises for processing prompts
    let fetchPromises = [];

    document.querySelectorAll('.container:not(.used)').forEach(function(container) {
        const prompt = container.querySelector('.promptInput').value;
        const imageGallery = container.querySelector('.imageGallery');

        // Mark the container as used
        container.classList.add('used');

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
                imageGallery.appendChild(img);
            });
            container.setAttribute('data-prompt-id', data.prompt_id);
            // tsnePlot.innerHTML = ''; // Clear the t-SNE plot container
            // // Display t-SNE plot if available
            // if(data.tsne_plot){
            //     const tsneImage = document.createElement('img');
            //     tsneImage.src = data.tsne_plot;
            //     tsneImage.classList.add('tsne-image');
            //     tsnePlot.appendChild(tsneImage);
            // }
        });

        fetchPromises.push(fetchPromise);
    });
    Promise.all(fetchPromises).then(() => {
      fetch('/api/get-umap')
      .then(response => response.json())
      .then(data => {
          console.log("Data fetched successfully:", data);
          // You can call a function here to handle the data, such as rendering a chart
          renderUMAPVisualization(data);
      })
      .catch(error => {
          console.error('Error fetching UMAP data:', error);
      });
    });
    
  });

    function renderUMAPVisualization(data) {
    const uniqueSteps = [...new Set(data.map(item => item.step))].sort((a, b) => a - b);

    const promptColors = {};
    const colorPalette = Plotly.d3.scale.category10(); // Provides up to 10 unique colors

    data.forEach(d => {
        if (!promptColors[d.prompt_id]) {
            promptColors[d.prompt_id] = colorPalette(Object.keys(promptColors).length % 10);
        }
    });

    const traces = [{
        x: data.map(d => d.x),
        y: data.map(d => d.y),
        mode: 'markers',
        type: 'scatter',
        marker: {
            size: 5,
            color: data.map(d => promptColors[d.prompt_id]),
            opacity: 0.5
        }
    }];

    const frames = uniqueSteps.map(step => ({
        name: step.toString(),
        data: [{
            x: data.map(d => d.x),
            y: data.map(d => d.y),
            marker: {
                size: data.map(d => d.step === step ? 10 : 5),
                color: data.map(d => promptColors[d.prompt_id]),
                opacity: data.map(d => d.step === step ? 1.0 : 0.5)
            }
        }],
        layout: {
            annotations: [{
                xref: 'paper',
                yref: 'paper',
                x: 0.5,
                y: 1.1,
                showarrow: false,
                text: `Step: ${Math.round(step * 50 + 1)}`, // Adjusted to show the actual step number
                font: {size: 16}
            }]
        }
    }));

    const layout = {
        title: 'UMAP Visualization Animated Over Steps',
        xaxis: { title: 'UMAP Dimension 1' },
        yaxis: { title: 'UMAP Dimension 2' },
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
        }],
        annotations: [{
            xref: 'paper',
            yref: 'paper',
            x: 0.5,
            y: 1.1,
            showarrow: false,
            text: `Starting Step: ${Math.round(uniqueSteps[0] * 50 + 1)}`, // Display the initial actual step
            font: {size: 16}
        }]
    };

    Plotly.newPlot('umapVisualization', traces, layout).then(function() {
        Plotly.addFrames('umapVisualization', frames);
    });
}
    
    
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
                    newContainer.remove(); // Remove the container if the backend deletion was successful
                    console.log(data.message);
                    
                } else {
                    console.error('Failed to delete prompt:', data.message);
                }
            })
            .catch(error => console.error('Error deleting prompt:', error));
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
    });