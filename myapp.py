import torch
from diffusers import StableDiffusionPipeline

from flask import Flask, send_file, request, jsonify, render_template
from flask_cors import CORS # allows the frontend to get resources from localhost
from io import BytesIO
import base64
from huggingface_hub import login
from logging import FileHandler,WARNING
from sklearn.manifold import TSNE
import matplotlib.pyplot as plt
import numpy as np
app = Flask(__name__)
file_handler = FileHandler('errorlog.txt')
file_handler.setLevel(WARNING)

CORS(app)  # Enable CORS for all routes

def generate_image_using_model(prompt):
    # access_token_read = "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"
    # login(token = access_token_read, add_to_git_credential=True)
    # print("\n\n\n Loged in\n\n\n")
    model_id = "CompVis/stable-diffusion-v1-4"
    device = "cuda"
    access_token = "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"
    print("here\n")
    pipe = StableDiffusionPipeline.from_pretrained(model_id, safety_checker=None, torch_dtype=torch.float16)
    pipe = pipe.to(device)
    print("Got model\n")
    vae = pipe.vae
    images = []
    latent_list = []
    image_step = 5  # Interval to save images
    
    def latents_callback(i, t, latents):
        scaled_latents = 1 / 0.18215 * latents
        latent_list.append(scaled_latents.cpu().detach().numpy())

        if i % image_step == 0:
            image = pipe.vae.decode(scaled_latents).sample[0]
            image = (image / 2 + 0.5).clamp(0, 1)
            image = image.cpu().permute(1, 2, 0).numpy()
            pil_image = pipe.numpy_to_pil(image)
            images.append(pil_image)
        
    print("Ready for pipeline\n")
    pipe(prompt, callback=latents_callback, callback_steps=1)
    return images, latent_list
    
def generate():
    data = request.get_json()
    print(data)
    prompt = data['prompt']
    images, latents = generate_image_using_model(prompt)
    
    # Process images for return
    image_data = []
    for image in images:
        img_io = BytesIO()
        image.save(img_io, 'PNG')
        img_io.seek(0)
        image_data.append('data:image/png;base64,' + base64.b64encode(img_io.getvalue()).decode('utf-8'))

    # Perform t-SNE on the collected latents
    latents_array = np.array(latents)
    tsne = TSNE(n_components=2, random_state=42)
    tsne_results = tsne.fit_transform(latents_array.reshape(latents_array.shape[0], -1))
    
    # Create a scatter plot of the t-SNE results
    plt.figure(figsize=(8, 6))
    plt.scatter(tsne_results[:, 0], tsne_results[:, 1], c=np.linspace(0, 1, tsne_results.shape[0]), cmap='viridis')
    plt.colorbar(label='Step in generation process')
    plt.title('t-SNE of Latents')

    # Save the plot to a BytesIO object in PNG format
    img_io = BytesIO()
    plt.savefig(img_io, format='png')
    img_io.seek(0)
    tsne_image_base64 = 'data:image/png;base64,' + base64.b64encode(img_io.getvalue()).decode('utf-8')
    
    # Return both the images and the t-SNE plot
    return jsonify({'images': image_data, 'tsne_plot': tsne_image_base64})

    

@app.route('/hello')
def hello():
    images = generate_image_using_model("hello world")
    img_io = BytesIO()
    images[3].save(img_io, 'PNG')
    img_io.seek(0)
    return send_file(img_io, mimetype='image/png')

@app.route('/')
def start():
    return render_template('index.html')

if __name__ == '__main__':
   app.run(debug = True)