import torch
from diffusers import StableDiffusionPipeline

from flask import Flask, send_file, request, jsonify, render_template
from flask_cors import CORS # allows the frontend to get resources from localhost
from io import BytesIO
import base64
from huggingface_hub import login

           
app = Flask(__name__)
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
    
    def latents_callback(i, t, latents):
        latents = 1 / 0.18215 * latents
        image = vae.decode(latents).sample[0]
        image = (image / 2 + 0.5).clamp(0, 1)
        image = image.cpu().permute(1, 2, 0).numpy()
        images.extend(pipe.numpy_to_pil(image))
        
    print("Ready for pipeline\n")
    pipe(prompt, callback=latents_callback, callback_steps = 5)  
    return images
    
@app.route('/api/generate', methods=['POST'])
def generate():
    data = request.get_json()
    print(data)
    prompt = data['prompt']
    images = generate_image_using_model(prompt)
    image_data = []
    for image in images:
        img_io = BytesIO()
        image.save(img_io, 'PNG')
        img_io.seek(0)
        image_data.append('data:image/png;base64,' + base64.b64encode(img_io.getvalue()).decode('utf-8'))
    return jsonify({'images': image_data})
    

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