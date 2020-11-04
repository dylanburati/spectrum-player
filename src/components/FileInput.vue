<template>
  <span>
    <slot name="before"></slot>
    <button class="btn-secondary relative mx-1">
      <slot name="default">Choose File</slot>

      <input
        type="file"
        :accept="accept"
        :multiple="multiple"
        :title="title"
        @change="(ev) => $emit('change', ev)"
      />
    </button>
    <slot name="after"></slot>
  </span>
</template>

<script>
export default {
  name: "FileInput",
  props: {
    accept: String,
    multiple: Boolean,
    title: String,
  },
};
</script>

<style scoped>
.mx-1 {
  margin-left: 0.25rem;
  margin-right: 0.25rem;
}
input[type="file"] {
  position: absolute;
  width: 100%;
  height: 100%;
  bottom: 0;
  left: 0;
  opacity: 0;
  cursor: pointer;
}
</style>
