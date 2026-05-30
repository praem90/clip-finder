use candle_core::safetensors::load;
use candle_core::DType;
use candle_core::Device;
use candle_core::Tensor;
use candle_nn::ops::softmax;
use candle_nn::Module;
use candle_nn::VarBuilder;
use candle_transformers::models::clip::{
    text_model::{ClipTextConfig, ClipTextTransformer},
    ClipConfig, ClipModel,
};

use tokenizers::tokenizer::Tokenizer;

pub fn model() {
    let config = ClipConfig::vit_base_patch32();

    let paths = [
            "/Users/praem90/personal/video-search-ai/ClipFinder/engine/.models/clip-ViT-B-32/model.safetensors",
    ];

    let vb = unsafe {
        VarBuilder::from_mmaped_safetensors(&paths, DType::F32, &Device::Cpu)
            .unwrap_or_else(|e| panic!("Failed to load safetensors: {:?}", e))
    };

    let model = ClipModel::new(vb, &config).unwrap();
}

pub fn get_text_embedding(text: String) -> Result<Vec<f32>, String> {
    let config = ClipTextConfig::vit_base_patch32();

    let path = "/Users/praem90/personal/video-search-ai/ClipFinder/engine/.models/clip-ViT-B-32/model.safetensors";

    let vb = unsafe {
        VarBuilder::from_mmaped_safetensors(std::slice::from_ref(&path), DType::F32, &Device::Cpu)
            .unwrap_or_else(|e| panic!("Failed to load safetensors: {:?}", e))
    };

    let model = ClipTextTransformer::new(vb.pp("text_model"), &config)
        .unwrap_or_else(|e| panic!("Failed to load model: {:?}", e));

    let tokenizer = tokenizer();
    let mut tokens = vec![];
    let encoding = tokenizer.encode(text, true).unwrap();
    tokens.push(encoding.get_ids().to_vec());
    let logits_per_text = model
        .forward(&Tensor::new(tokens, &Device::Cpu).unwrap())
        .unwrap();

    let softmaxed = softmax(&logits_per_text, 1).unwrap();
    let softmaxed_vec: Vec<f32> = softmaxed.flatten_all().unwrap().to_vec1().unwrap();
    return Ok(softmaxed_vec);
}

pub fn tokenizer() -> Tokenizer {
    Tokenizer::from_file("/Users/praem90/personal/video-search-ai/ClipFinder/engine/.models/clip-vit-base-patch32/tokenizer.json").unwrap()
}
