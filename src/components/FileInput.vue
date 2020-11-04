<template>
  <span class="max-w-33">
    <button class="btn-secondary relative mr-1">
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
.max-w-33 {
  max-width: 33%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: pre;
}
.mr-1 {
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
